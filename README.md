## Running the Next.js App Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Setup Instructions
1. **Navigate to the flexiscribe directory:**
   ```powershell
   cd flexiscribe
   ```
2. **Install dependencies:**
   ```powershell
   npm install
   ```
3. **Start the development server:**
   ```powershell
   npm run dev
   ```
   The app will be available at `http://localhost:3000` by default.

### Production Build
To build and start the app in production mode:
```powershell
npm run build
npm start
```

### Transferring to Another Device
- Copy the entire `flexiscribe` folder.
- On the new device, repeat the setup steps above.
- All dependencies are listed in `package.json` and will be installed with `npm install`.

