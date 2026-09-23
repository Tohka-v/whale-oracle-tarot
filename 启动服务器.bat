@echo off
rem ============================================================
rem  本文件是 GBK(936) 编码，不要另存为 UTF-8。
rem  cmd.exe 解析 .bat 时用的是「当前代码页」，UTF-8 的中文一旦跨越它的
rem  读取缓冲区边界就会字节错位，冒出
rem  「'xxx' is not recognized as an internal or external command」。
rem  Node 的输出是 UTF-8，所以在调用它之前临时切 65001，回来再切回 936。
rem ============================================================
setlocal

rem 切到本 .bat 所在目录（就是项目根）。
rem %~dp0 自带结尾反斜杠，写成 "%~dp0.." 会跑到【上一级】，找不到 tools\serve.mjs。
cd /d "%~dp0"

echo.
echo   星海鲸语 · Whale Oracle Tarot
echo   =====================================================
echo   用法：启动服务器.bat [端口] [--local] [--no-qr]
echo.
echo     默认端口 4173，监听所有网卡，手机可以直接访问。
echo     --local   只允许本机访问（手机就连不上了）
echo     --no-qr   不打印二维码
echo.
echo   手机怎么连：
echo     1. 手机连上和电脑同一个 Wi-Fi，别用流量
echo     2. 用相机扫窗口里打印的二维码；
echo        或手动输入启动日志里「手机：」那一行的地址
echo     3. 还打不开，就照启动日志里列的三条排查走
echo.
echo   本窗口要保持开着，关掉就是停止服务。
echo   =====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [错误] 找不到 Node.js。
  echo   请先安装 Node.js 18 或更高版本： https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "tools\serve.mjs" (
  echo   [错误] 当前目录下找不到 tools\serve.mjs
  echo   当前目录：%CD%
  echo   请确认本文件与 index.html、tools\ 在同一层目录。
  echo.
  pause
  exit /b 1
)

chcp 65001 >nul
node "tools\serve.mjs" %*
set "EXITCODE=%ERRORLEVEL%"
chcp 936 >nul

echo.
if "%EXITCODE%"=="0" (
  echo   服务器已停止。
) else (
  echo   服务器异常退出，退出码 %EXITCODE%
  echo.
  echo   最常见的两种：
  echo     - 端口被占用：换一个，  启动服务器.bat 4174
  echo     - 本机能开、手机打不开：看启动日志里那三条排查，
  echo       通常是 IP 用错（VPN 网卡）或防火墙没放行
)
echo.
pause
exit /b %EXITCODE%