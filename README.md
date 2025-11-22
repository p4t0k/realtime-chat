# Realtime Chat

## About
The basic idea behind this project is based on the `PHONE` utility from the OpenVMS operating system. The chat itself is oriented towards privacy and anonymity. It does not save any data for the long term.

It is designed to be "real-time" in the sense of a group conversation where words are streamed by the people to the people. Just like in a real group discussion, you might not catch everything from everyone, preserving the ephemeral nature of spoken conversation.

## Getting Started

### Development Mode
To run the project in development mode:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Configuration

The application uses environment variables for configuration.

1.  Copy the example configuration file:
    ```bash
    cp .env.example .env
    ```

2.  Edit `.env` to customize your settings:
    -   `PORT`: Server port (default: 3000)
    -   `CORS_ORIGIN`: Comma-separated list of allowed origins (e.g., `https://chat.example.com,http://localhost:5173`)
    -   Rate limits and validation constants can also be overridden here.

## Repository
[https://github.com/p4t0k/realtime-chat](https://github.com/p4t0k/realtime-chat)

---

## Technical Details (Vite Template)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
