# Datacenter Map

A web-based interactive mapping application for visualizing data centers.

## Tech Stack
* **Build Tool:** Vite
* **Language:** TypeScript
* **Map Library:** Mapbox GL JS
* **Data Parsing:** PapaParse
* **Package Manager:** Bun

## Getting Started

### Prerequisites
* [Bun](https://bun.sh/) installed on your machine.
* A Mapbox access token.

### Installation

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up your environment variables by copying the example file and adding your Mapbox token:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

### Building for Production

To build the application for production, run:
```bash
bun run build
```
The compiled assets will be placed in the `dist` directory.