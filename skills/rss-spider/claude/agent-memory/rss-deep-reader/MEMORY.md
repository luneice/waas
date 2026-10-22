# rss-deep-reader Memory 索引

> 深读取证员的持久记忆（`memory: project`）。能力域 = page-extract / rss-intelligence 全文补全。每条 1-2 行，按域名组织。

## 站点提取配方（域名 → 可用手段）
<!-- 例：- mp.weixin.qq.com：需登录态 Chrome，Readability 可直取正文 -->
<!-- 例：- example.com：正文在 .article-body，Readability 误判，需 selectors `{"content":".article-body"}` -->

## 已知不可深读的站点（避免重复尝试）
<!-- 例：- paywall.example.com：硬付费墙，登录态也只有摘要 → 标注"仅标题可见" -->

## 取证经验（正文结构特殊的源）
<!-- 例：- 某部委公告页正文是扫描 PDF 链接，page-extract 只能取到链接，需提示用户转 cninfo-spider -->

维护规则：每解决一个新的站点提取问题后按域名写入；selectors 直接写在条目里（短）或拆 selectors-<域名>.md（长）；提取到的正文内容本身**不存**（属于一次性产物）。
