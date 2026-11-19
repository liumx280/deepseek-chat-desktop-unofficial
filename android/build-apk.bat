@echo off
setlocal enabledelayedexpansion
for %%I in ("%~dp0..") do set WS=%%~fI
if not defined JDK set JDK=%WS%\.tools\jdk\jdk-17
if not defined SDK set SDK=%WS%\.tools\android-sdk
set BT=%SDK%\build-tools\34.0.0
set PLAT=%SDK%\platforms\android-34\android.jar
set APP=%WS%\android\app\src\main
set OUT=%WS%\.tools\apkbuild
set APKVER=1.0.2
set JAVA_HOME=%JDK%
set PATH=%JAVA_HOME%\bin;%PATH%

if not exist "%BT%\aapt2.exe" ( echo MISSING_BUILD_TOOLS & exit /b 1 )
if not exist "%PLAT%" ( echo MISSING_PLATFORM & exit /b 1 )

if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%" 2>nul
mkdir "%OUT%\gen" 2>nul
mkdir "%OUT%\classes" 2>nul
mkdir "%OUT%\dex" 2>nul

echo === compile resources ===
"%BT%\aapt2.exe" compile --dir "%APP%\res" -o "%OUT%\res.zip" || exit /b 2

echo === link ===
"%BT%\aapt2.exe" link -o "%OUT%\base.apk" -I "%PLAT%" --manifest "%APP%\AndroidManifest.xml" --java "%OUT%\gen" --min-sdk-version 24 --target-sdk-version 34 --auto-add-overlay "%OUT%\res.zip" || exit /b 3

echo === add assets ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%WS%\scripts\add-assets.ps1" -Apk "%OUT%\base.apk" -Assets "%APP%\assets" || exit /b 10

echo === javac ===
set SRC=
for /r "%APP%\java" %%f in (*.java) do set SRC=!SRC! "%%f"
for /r "%OUT%\gen" %%f in (*.java) do set SRC=!SRC! "%%f"
"%JDK%\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath "%PLAT%" -d "%OUT%\classes" !SRC! || exit /b 4

echo === d8 ===
set CLS=
for /r "%OUT%\classes" %%f in (*.class) do set CLS=!CLS! "%%f"
"%JDK%\bin\java.exe" -cp "%BT%\lib\d8.jar" com.android.tools.r8.D8 --lib "%PLAT%" --min-api 24 --output "%OUT%\dex" !CLS! || exit /b 5

echo === package dex ===
copy /y "%OUT%\base.apk" "%OUT%\unsigned.apk" >nul
cd /d "%OUT%\dex"
"%JDK%\bin\jar.exe" uf "%OUT%\unsigned.apk" classes.dex || exit /b 6
cd /d "%WS%"

echo === align ===
"%BT%\zipalign.exe" -f 4 "%OUT%\unsigned.apk" "%OUT%\aligned.apk" || exit /b 7
echo unsigned-apk: %OUT%\aligned.apk

if /i "%~1"=="nosign" (
  echo === skipped signing ^(nosign^) ===
  exit /b 0
)

echo === sign ===
if not exist "%WS%\.tools\keystore.jks" (
  echo generating keystore .tools\keystore.jks
  "%JDK%\bin\keytool.exe" -genkeypair -keystore "%WS%\.tools\keystore.jks" -alias deepseek -keyalg RSA -keysize 2048 -validity 10000 -storepass deepseek -keypass deepseek -dname "CN=DeepSeek Chat Unofficial, O=liumx, C=CN" || exit /b 8
)
"%JDK%\bin\java.exe" -jar "%BT%\lib\apksigner.jar" sign --ks "%WS%\.tools\keystore.jks" --ks-pass pass:deepseek --key-pass pass:deepseek --ks-key-alias deepseek --out "%WS%\release\DeepSeek-Chat-%APKVER%-android.apk" "%OUT%\aligned.apk" || exit /b 9
echo === done ===
dir "%WS%\release\DeepSeek-Chat-%APKVER%-android.apk"
