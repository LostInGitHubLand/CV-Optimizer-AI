# CV Optimizer AI test suite

This folder tests the whole app pipeline: Fetcher, Analyst, Writer, Designer/Semantic Design Engine, security, progress, restore, and optional qwen3 LLM-as-judge evals.

Normal tests do not require Ollama, Puppeteer, real PDF parsing, or real PDF generation.

```bash
npm run test
npm run test:coverage
RUN_LLM_EVALS=true LLM_JUDGE_MODEL=qwen3 npm run test:eval
```

Suggested `package.json` scripts are in `tests/package-scripts.snippet.json`.
