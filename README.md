# LexiKeep

**Read what you love. Keep what you learn.**

LexiKeep is a free, open-source, local-first reading tool that builds vocabulary while you read. Import an article, a book, or movie subtitles — tap any word to see its meaning on the spot, and let smart review make it stick.

> [中文版](README.zh-CN.md) · [日本語版](README.ja.md)

## Is LexiKeep for you?

- You are learning **English, Japanese, German, or Chinese**
- You prefer learning from **real content** — articles, books, subtitles — over word lists
- You watch shows or movies and want to learn the words that come up
- You care about **privacy** and don't want to register an account or upload your data
- You want a **free, open-source** tool that works **offline**

If any of these sound like you, LexiKeep is built for you. No account is required, and the core learning flow works offline.

## How to use it

1. **Import** — drop in a `.txt`, `.srt`, or `.vtt` file, or pull YouTube subtitles
2. **Read** — read line by line, tap any word for its meaning and reading
3. **Collect** — new words and phrases are gathered into your word list automatically
4. **Review** — LexiKeep reminds you at just the right time, a few minutes a day

## Features at a glance

- **Learn from what you love** — your own articles, books, and subtitles, not a preset word list
- **Tap-to-look-up** — meaning, pronunciation, and example sentence without losing your place
- **Smart review** — spaced repetition that nudges you right before you forget
- **Built-in offline dictionaries** — English, Japanese, German, and Chinese, no internet needed
- **Your data stays yours** — everything is saved locally, no account or upload required
- **AI is optional** — use local Ollama, Qwen, or another OpenAI-compatible API for explanations and translations; off by default

## Privacy

All your study data is stored in a local database on your device. Nothing is uploaded unless you explicitly ask — for example, when you turn on AI or download YouTube subtitles.

## Download & install

Grab the latest installer for **macOS / Windows / Linux / Android** from the [Releases page](https://github.com/Pnut-You/LexiKeep/releases/latest).

> Installers are currently **unsigned** — your system may show a security warning on first install. That's expected. See [DISTRIBUTION.md](DISTRIBUTION.md) for the platform-by-platform guide.

## Support the project

LexiKeep is free and open source. If it helps you, a star or contribution on GitHub goes a long way: [github.com/Pnut-You/LexiKeep](https://github.com/Pnut-You/LexiKeep)

## Development

For contributors. Requires Node.js 20+ and Rust 1.77.2+.

The React frontend lives in `src/`; the Tauri/Rust backend lives in `src-tauri/src/`. This split is intentional. Product scope and decisions are documented in [docs/PRODUCT.md](docs/PRODUCT.md).

```bash
npm install        # install frontend dependencies
npm run tauri dev  # run as a desktop app
npm run build      # typecheck + frontend build
npm test           # frontend tests
cd src-tauri && cargo test   # Rust tests
```

Build installers with `npm run tauri build` (output in `src-tauri/target/release/bundle/`).

## License

MIT License — see [LICENSE](LICENSE). Third-party dictionary data credits: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Import custom dictionary packs per [DICTIONARY_PACK.md](DICTIONARY_PACK.md).
