/**
 * bilibili-spider 能力全景 —— IoC 组装点。
 *
 * | 模块      | Skill 数 | 页面路径                          | 产物形态 |
 * |-----------|---------|-----------------------------------|----------|
 * | search    | 1       | search.bilibili.com               | items    |
 * | creator   | 6       | space.bilibili.com/{mid}          | items / detail |
 * | channel   | 1       | space.bilibili.com/{mid}/channel  | items    |
 * | video     | 1       | www.bilibili.com/video/{bvid}     | content + 落盘 |
 * | article   | 1       | www.bilibili.com/opus/{opusId}    | content + 落盘 |
 * | comment   | 1       | 依附于视频/专栏（oid + type）      | items + topItems + 落盘 |
 *
 * 全部 11 个 Skill 的 `.data` 都是 AI-Ready 信封（`meta` + `insights` + body），
 * body 字段名见上表；信封类型定义在 `projections/envelope.ts`。
 */
import {
  ChromeSessionProvider,
  ContentStore,
  createGoalExecutor,
  FileArtifactSink,
  SkillRegistry,
  type GoalSkillDeps,
} from "@spider/core";
import { join } from "node:path";
import { BiliSearchSkill } from "@src/skills/search/search.skill";
import { BiliVideoSkill } from "@src/skills/video/download.skill";
import { BiliArticleSkill } from "@src/skills/article/extract.skill";
import { BiliCommentsSkill } from "@src/skills/comment/extract.skill";
import { BiliChannelSkill } from "@src/skills/channel/detail.skill";
import {
  BiliCreatorSkill,
  BiliCreatorVideosSkill,
  BiliCreatorFeedSkill,
  BiliCreatorArticlesSkill,
  BiliCreatorChannelsSkill,
  BiliCreatorAudiosSkill,
} from "@src/skills/creator";

export const createDefaultRegistry = (
  deps?: Partial<GoalSkillDeps>,
  browserURL?: string,
  storageRoot?: string,
): SkillRegistry => {
  const root = storageRoot ?? process.cwd();
  const outputDir = join(root, "bilibili");
  const contentStore = new ContentStore(outputDir);
  const goalDeps: GoalSkillDeps = {
    sessionProvider:
      deps?.sessionProvider ?? new ChromeSessionProvider({ browserURL }),
    goalExecutor: deps?.goalExecutor ?? createGoalExecutor(),
    artifactSink:
      deps?.artifactSink ?? new FileArtifactSink(outputDir, { conflictPolicy: "rename" }),
  };

  return new SkillRegistry()
    .register(new BiliSearchSkill(goalDeps))
    .register(new BiliCreatorSkill(goalDeps))
    .register(new BiliCreatorVideosSkill(goalDeps))
    .register(new BiliCreatorArticlesSkill(goalDeps))
    .register(new BiliCreatorAudiosSkill(goalDeps))
    .register(new BiliCreatorChannelsSkill(goalDeps))
    .register(new BiliCreatorFeedSkill(goalDeps))
    .register(new BiliVideoSkill(goalDeps, { outputDir, contentStore }))
    .register(new BiliArticleSkill(goalDeps, { outputDir, contentStore }))
    .register(new BiliCommentsSkill(goalDeps, { outputDir, contentStore }))
    .register(new BiliChannelSkill(goalDeps));
};
