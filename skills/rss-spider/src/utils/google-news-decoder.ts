/**
 * Google News URL 判断工具
 *
 * Google News RSS 的 <link> 是 news.google.com/rss/articles/CBMi... 格式的
 * 重定向 URL。本模块仅提供 URL 格式判断，真实链接通过浏览器重定向获取。
 */

/**
 * 判断是否为 Google News 文章重定向 URL
 */
export function isGoogleNewsUrl(url: string): boolean {
  return /^https?:\/\/news\.google\.com\/rss\/articles\//.test(url);
}

