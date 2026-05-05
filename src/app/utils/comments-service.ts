// Comments service now using JSONBin.io cloud storage
// This replaces the previous Supabase implementation

export type { Comment, CommentSettings } from './cloud-storage';

export {
  createComment,
  getComments,
  getAllCommentsForSitemap,
  resolveComment,
  deleteComment,
  getCommentSettings,
  updateCommentSettings,
} from './cloud-storage';