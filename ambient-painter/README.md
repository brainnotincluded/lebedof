# Ambient Painter
Камера → анализ цвета/мазков → непрерывная «ангельская» эмбиент‑музыка в реальном времени.

Работает прямо в браузере (Vite + React + Tone.js). Никаких Python/серверов не нужно.

## Онлайн‑версия (GitHub Pages)
`https://brainnotincluded.github.io/lebedof/`

Если камера не включается на онлайн‑версии — проверь разрешения камеры в браузере.

## Что нужно (самое важное)
- Компьютер с камерой.
- Браузер: Chrome / Edge (рекомендуется). Safari/Firefox тоже могут работать, но чаще капризничают с аудио/камерой.
- Node.js (лучше LTS) + npm.

## Запуск (если уже стоит Node.js)
1) Скачай проект:
- Вариант A (через git):
  ```bash
  git clone https://github.com/brainnotincluded/lebedof.git
  ```
- Вариант B (через ZIP): на GitHub нажми **Code → Download ZIP**, распакуй.

2) Запусти:
```bash
cd lebedof/ambient-painter
npm install
npm run dev
```

3) Открой адрес, который покажет Vite (обычно `http://localhost:5173`).
4) Нажми **Start camera** → разреши камеру.
5) Нажми **Start audio** → пойдёт музыка.

Важно: звук не стартует сам — это ограничение браузеров, поэтому нужно нажать кнопку.

## Установка на Windows (очень просто)
### Шаг 1. Установи Node.js
Самый простой способ:
- Скачай **Node.js LTS** с сайта nodejs.org и установи (Next → Next → Install).

Проверка:
```powershell
node -v
npm -v
```
Если команды не находятся — перезагрузи PowerShell/Terminal (иногда нужно перелогиниться).

### Шаг 2. Скачай проект
Вариант A (рекомендуется):
- Установи Git: https://git-scm.com/download/win
- Клонируй:
  ```powershell
  git clone https://github.com/brainnotincluded/lebedof.git
  ```

Вариант B:
- GitHub → **Code → Download ZIP** → распакуй.

### Шаг 3. Запусти
Открой PowerShell в папке проекта и выполни:
```powershell
cd lebedof\ambient-painter
npm install
npm run dev
```
Открой ссылку из консоли (обычно `http://localhost:5173`).

### Шаг 4. Разреши камеру
Если камера не работает: Windows → **Settings → Privacy & security → Camera** → разреши доступ для браузера.

## Установка на macOS
### Вариант A (самый простой)
- Скачай **Node.js LTS** (macOS Installer `.pkg`) с nodejs.org и установи.

Проверка в Terminal:
```bash
node -v
npm -v
```

### Вариант B (если есть Homebrew)
```bash
brew install node
```

Дальше запуск такой же:
```bash
git clone https://github.com/brainnotincluded/lebedof.git
cd lebedof/ambient-painter
npm install
npm run dev
```

## Установка на Linux
Ниже два варианта. Если не хочешь думать — делай через **nvm**.

### Вариант A (рекомендуется): nvm + Node LTS
1) Установи nvm (Node Version Manager):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```
2) Перезапусти терминал.
3) Поставь Node LTS:
```bash
nvm install --lts
nvm use --lts
node -v
npm -v
```

### Вариант B: через пакетный менеджер
На Ubuntu/Debian обычно можно поставить Node, но версии часто старые. Если всё же хочешь — лучше ставить через nvm.

### Запуск
```bash
git clone https://github.com/brainnotincluded/lebedof.git
cd lebedof/ambient-painter
npm install
npm run dev
```

## Полезные команды
- Dev (для разработки):
  ```bash
  npm run dev
  ```
- Сборка:
  ```bash
  npm run build
  ```
- Запуск собранной версии:
  ```bash
  npm run preview
  ```

## Частые проблемы (FAQ)
### 1) «Звук не играет»
- Ты нажал **Start audio**? Без клика браузер не даст запустить аудио.
- Проверь, что вкладка не в mute и системная громкость не на нуле.

### 2) «Камера не включается»
- Разреши камеру в браузере.
- Проверь системные разрешения (особенно на Windows/macOS).
- Запускать нужно через `npm run dev` и `http://localhost:5173` (не через файл `index.html`).

### 3) «Сильно лагает / грузит CPU»
- Уменьши **Downscale size** (например до 64–80).
- Уменьши **Analysis FPS**.
- Выключи **Air layer** или уменьшай Reverb/Chorus.

### 4) «Как поменять камеру?»
В правой панели есть селект **Camera**.
