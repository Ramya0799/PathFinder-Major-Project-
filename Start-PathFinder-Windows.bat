@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto no_node
where corepack >nul 2>nul
if errorlevel 1 goto no_corepack

echo Installing project dependencies from pnpm-lock.yaml...
corepack pnpm install --frozen-lockfile
if errorlevel 1 goto install_failed

echo.
echo Building the client application...
corepack pnpm exec vite build --configLoader native
if errorlevel 1 goto build_failed

set "NODE_ENV=production"
set "HOST=127.0.0.1"
set "PORT=3000"
set "PATHFINDER_SOURCE_SERVER=1"
echo.
echo Starting PathFinder. Keep this window open while using the app.
echo Open http://127.0.0.1:3000/map after the terminal reports that the server is running.
corepack pnpm start
goto end

:no_node
echo Node.js 20 or later is required. Install Node.js, then run this file again.
pause
exit /b 1

:no_corepack
echo Corepack was not found. Install or enable Corepack with your Node.js installation.
pause
exit /b 1

:install_failed
echo Dependency installation failed. Check the message above and try again.
pause
exit /b 1

:build_failed
echo The client build failed. Check the message above and try again.
pause
exit /b 1

:end
endlocal
