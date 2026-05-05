import { onRequestGet as __api_comment_settings__sitemapId__ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/comment-settings/[sitemapId].ts"
import { onRequestPut as __api_comment_settings__sitemapId__ts_onRequestPut } from "/Users/zander/localhost/planner/functions/api/comment-settings/[sitemapId].ts"
import { onRequestDelete as __api_comments__id__ts_onRequestDelete } from "/Users/zander/localhost/planner/functions/api/comments/[id].ts"
import { onRequestPut as __api_comments__id__ts_onRequestPut } from "/Users/zander/localhost/planner/functions/api/comments/[id].ts"
import { onRequestGet as __api_short_urls__shortId__ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/short-urls/[shortId].ts"
import { onRequestDelete as __api_sitemaps__id__ts_onRequestDelete } from "/Users/zander/localhost/planner/functions/api/sitemaps/[id].ts"
import { onRequestGet as __api_sitemaps__id__ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/sitemaps/[id].ts"
import { onRequestPut as __api_sitemaps__id__ts_onRequestPut } from "/Users/zander/localhost/planner/functions/api/sitemaps/[id].ts"
import { onRequestGet as __api_comments_index_ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/comments/index.ts"
import { onRequestPost as __api_comments_index_ts_onRequestPost } from "/Users/zander/localhost/planner/functions/api/comments/index.ts"
import { onRequestGet as __api_page_types_ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/page-types.ts"
import { onRequestPut as __api_page_types_ts_onRequestPut } from "/Users/zander/localhost/planner/functions/api/page-types.ts"
import { onRequestGet as __api_short_urls_index_ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/short-urls/index.ts"
import { onRequestPost as __api_short_urls_index_ts_onRequestPost } from "/Users/zander/localhost/planner/functions/api/short-urls/index.ts"
import { onRequestGet as __api_sitemaps_index_ts_onRequestGet } from "/Users/zander/localhost/planner/functions/api/sitemaps/index.ts"

export const routes = [
    {
      routePath: "/api/comment-settings/:sitemapId",
      mountPath: "/api/comment-settings",
      method: "GET",
      middlewares: [],
      modules: [__api_comment_settings__sitemapId__ts_onRequestGet],
    },
  {
      routePath: "/api/comment-settings/:sitemapId",
      mountPath: "/api/comment-settings",
      method: "PUT",
      middlewares: [],
      modules: [__api_comment_settings__sitemapId__ts_onRequestPut],
    },
  {
      routePath: "/api/comments/:id",
      mountPath: "/api/comments",
      method: "DELETE",
      middlewares: [],
      modules: [__api_comments__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/comments/:id",
      mountPath: "/api/comments",
      method: "PUT",
      middlewares: [],
      modules: [__api_comments__id__ts_onRequestPut],
    },
  {
      routePath: "/api/short-urls/:shortId",
      mountPath: "/api/short-urls",
      method: "GET",
      middlewares: [],
      modules: [__api_short_urls__shortId__ts_onRequestGet],
    },
  {
      routePath: "/api/sitemaps/:id",
      mountPath: "/api/sitemaps",
      method: "DELETE",
      middlewares: [],
      modules: [__api_sitemaps__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/sitemaps/:id",
      mountPath: "/api/sitemaps",
      method: "GET",
      middlewares: [],
      modules: [__api_sitemaps__id__ts_onRequestGet],
    },
  {
      routePath: "/api/sitemaps/:id",
      mountPath: "/api/sitemaps",
      method: "PUT",
      middlewares: [],
      modules: [__api_sitemaps__id__ts_onRequestPut],
    },
  {
      routePath: "/api/comments",
      mountPath: "/api/comments",
      method: "GET",
      middlewares: [],
      modules: [__api_comments_index_ts_onRequestGet],
    },
  {
      routePath: "/api/comments",
      mountPath: "/api/comments",
      method: "POST",
      middlewares: [],
      modules: [__api_comments_index_ts_onRequestPost],
    },
  {
      routePath: "/api/page-types",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_page_types_ts_onRequestGet],
    },
  {
      routePath: "/api/page-types",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_page_types_ts_onRequestPut],
    },
  {
      routePath: "/api/short-urls",
      mountPath: "/api/short-urls",
      method: "GET",
      middlewares: [],
      modules: [__api_short_urls_index_ts_onRequestGet],
    },
  {
      routePath: "/api/short-urls",
      mountPath: "/api/short-urls",
      method: "POST",
      middlewares: [],
      modules: [__api_short_urls_index_ts_onRequestPost],
    },
  {
      routePath: "/api/sitemaps",
      mountPath: "/api/sitemaps",
      method: "GET",
      middlewares: [],
      modules: [__api_sitemaps_index_ts_onRequestGet],
    },
  ]