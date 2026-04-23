# TTS Stream Segmentation

## 触发场景

- 当听课模式 `run`、预览 TTS、流式字幕或 `audio_segment` 的切分规则需要排查或调整时使用。
- 当怀疑“为什么这里没有切段 / 为什么这里切得太碎 / 为什么字幕时间轴不对”时使用。

## 核心规则

- `run` 听课模式里的流式字幕分段，优先检查 `src/api/flaskr/service/tts/sentence_boundaries.py` 的共享边界规则，再核对 `src/api/flaskr/service/tts/patterns.py` 的标点集合定义。
- 流式 TTS 的逗号属于弱边界，只有当前子句足够长时才应该切分；否则会显著增加 `audio_segment` 数量、heartbeat 和整体尾延迟。
- 如果修改了流式 TTS 的标点边界，同时更新 `src/api/flaskr/service/tts/pipeline.py` 使用的共享句边界 helper，保持流式与非流式拆分口径一致。
- 当同一条规则需要在流式与非流式链路复用时，优先抽到 `src/api/flaskr/service/tts/` 下的共享 helper，避免两处手写逻辑再次漂移。
- 当前标点切分规则如果扩展到新符号，优先补 `src/api/tests/service/tts/test_streaming_tts_finalize_segmentation.py` 的回归测试。
- 涉及视觉边界、图片、SVG、表格、iframe 等跳过逻辑时，不要只看标点；还要同步核对 `streaming_tts.py` 与 `pipeline.py` 的 AV boundary 行为。

## 排查路径

1. 从 `src/api/flaskr/service/learn/routes.py` 确认请求是否走 `run` SSE。
2. 再看 `src/api/flaskr/service/learn/runscript_v2.py` 和 `src/api/flaskr/service/learn/context_v2.py`，确认是否开启 listen-mode segmented TTS。
3. 进入 `src/api/flaskr/service/tts/streaming_tts.py`，确认实际使用的是哪种 processor，以及切分发生在 `process_chunk()` 还是 `finalize()`。
4. 若字幕内容与音频段数不一致，补查 `src/api/tests/service/tts/test_streaming_tts_subtitles.py` 与相关 listen element patch 流程。

## 回归检查

- 至少运行 `src/api/tests/service/tts/test_streaming_tts_finalize_segmentation.py`
- 如改动影响字幕累计，再跑 `src/api/tests/service/tts/test_streaming_tts_subtitles.py`
- 如改动影响视觉边界，再跑 `src/api/tests/service/tts/test_av_speakable_segmentation.py`
