import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import * as kv from './kv_store.tsx'

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.use('*', logger(console.log))

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Comment-related routes
app.post('/make-server-6ff34880/comments', async (c) => {
  try {
    const { sitemapId, pageId, commenterEmail, commenterName, content, allowedDomain } = await c.req.json()
    
    // Validate required fields
    if (!sitemapId || !pageId || !commenterEmail || !commenterName || !content) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    // Validate email domain if allowedDomain is specified
    if (allowedDomain && allowedDomain.trim() !== '') {
      const emailDomain = commenterEmail.split('@')[1]?.toLowerCase()
      const allowed = allowedDomain.toLowerCase().trim()
      
      if (!emailDomain || emailDomain !== allowed) {
        return c.json({ error: `Email must be from domain: ${allowedDomain}` }, 403)
      }
    }
    
    // Create comment object
    const comment = {
      id: crypto.randomUUID(),
      sitemapId,
      pageId,
      commenterEmail,
      commenterName,
      content,
      timestamp: new Date().toISOString(),
      resolved: false
    }
    
    // Store comment in KV store
    const commentKey = `comment_${comment.id}`
    await kv.set(commentKey, comment)
    
    // Also store in page-specific comment list for easier retrieval
    const pageCommentsKey = `page_comments_${sitemapId}_${pageId}`
    let pageComments = await kv.get(pageCommentsKey) || []
    pageComments.push(comment.id)
    await kv.set(pageCommentsKey, pageComments)
    
    return c.json({ success: true, comment })
  } catch (error) {
    console.error('Error creating comment:', error)
    return c.json({ error: 'Failed to create comment' }, 500)
  }
})

app.get('/make-server-6ff34880/comments/:sitemapId/:pageId', async (c) => {
  try {
    const { sitemapId, pageId } = c.req.param()
    
    // Get comment IDs for this page
    const pageCommentsKey = `page_comments_${sitemapId}_${pageId}`
    const commentIds = await kv.get(pageCommentsKey) || []
    
    // Retrieve all comments
    const comments = []
    for (const commentId of commentIds) {
      const comment = await kv.get(`comment_${commentId}`)
      if (comment) {
        comments.push(comment)
      }
    }
    
    // Sort by timestamp (newest first)
    comments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return c.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return c.json({ error: 'Failed to fetch comments' }, 500)
  }
})

app.put('/make-server-6ff34880/comments/:commentId/resolve', async (c) => {
  try {
    const { commentId } = c.req.param()
    const { resolved } = await c.req.json()
    
    // Get existing comment
    const comment = await kv.get(`comment_${commentId}`)
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    
    // Update resolved status
    comment.resolved = resolved
    await kv.set(`comment_${commentId}`, comment)
    
    return c.json({ success: true, comment })
  } catch (error) {
    console.error('Error updating comment:', error)
    return c.json({ error: 'Failed to update comment' }, 500)
  }
})

app.delete('/make-server-6ff34880/comments/:commentId', async (c) => {
  try {
    const { commentId } = c.req.param()
    
    // Get existing comment to find its page
    const comment = await kv.get(`comment_${commentId}`)
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404)
    }
    
    // Remove from page comments list
    const pageCommentsKey = `page_comments_${comment.sitemapId}_${comment.pageId}`
    let pageComments = await kv.get(pageCommentsKey) || []
    pageComments = pageComments.filter(id => id !== commentId)
    await kv.set(pageCommentsKey, pageComments)
    
    // Delete the comment
    await kv.del(`comment_${commentId}`)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return c.json({ error: 'Failed to delete comment' }, 500)
  }
})

// Comment settings routes
app.get('/make-server-6ff34880/sitemap/:sitemapId/comment-settings', async (c) => {
  try {
    const { sitemapId } = c.req.param()
    const settings = await kv.get(`comment_settings_${sitemapId}`) || {
      commentsEnabled: false,
      allowedDomain: ''
    }
    
    return c.json({ settings })
  } catch (error) {
    console.error('Error fetching comment settings:', error)
    return c.json({ error: 'Failed to fetch comment settings' }, 500)
  }
})

app.put('/make-server-6ff34880/sitemap/:sitemapId/comment-settings', async (c) => {
  try {
    const { sitemapId } = c.req.param()
    const { commentsEnabled, allowedDomain } = await c.req.json()
    
    const settings = {
      commentsEnabled: Boolean(commentsEnabled),
      allowedDomain: allowedDomain || ''
    }
    
    await kv.set(`comment_settings_${sitemapId}`, settings)
    
    return c.json({ success: true, settings })
  } catch (error) {
    console.error('Error updating comment settings:', error)
    return c.json({ error: 'Failed to update comment settings' }, 500)
  }
})

export default { fetch: app.fetch }

serve(app.fetch)