Unicode true
; DeepSeek Chat 安装包脚本 —— 用 NSIS 3 编译：
;   makensis packaging\installer.nsi
; 可用 /D 覆盖输出名与源目录，例如：
;   makensis /DAPP_VERSION=1.0.1 packaging\installer.nsi
!include "MUI2.nsh"

!ifndef APP_NAME
  !define APP_NAME "DeepSeek Chat"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "1.0.0"
!endif
!define APP_EXE "DeepSeek Chat.exe"
!define APP_ICO "DeepSeek Chat.ico"

; 待打包的便携版目录（scripts/make-portable.ps1 的输出）
!ifndef SRC
  !define SRC "${__FILEDIR__}\..\release\DeepSeek Chat"
!endif
!ifndef OUT
  !define OUT "${__FILEDIR__}\..\release\DeepSeek-Chat-Setup-${APP_VERSION}.exe"
!endif

Name "${APP_NAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\DeepSeek Chat"
InstallDirRegKey HKCU "Software\DeepSeekChat" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "${APP_NAME}"

!define MUI_ICON "${__FILEDIR__}\..\desktop\build\icon.ico"
!define MUI_UNICON "${__FILEDIR__}\..\desktop\build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 ${APP_NAME}"
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 ${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "这是 DeepSeek 官方 chat-demo 的 Windows 桌面封装（非官方项目）。$\r$\n$\r$\n安装完成后，首次使用需要在「设置」里填入自己的 DeepSeek API Key。$\r$\n$\r$\n所有数据只保存在本机。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Install" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_ICO}" 0
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_ICO}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\DeepSeekChat" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "Publisher" "DeepSeek Chat Desktop contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "DisplayIcon" "$INSTDIR\${APP_ICO}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\DeepSeekChat"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekChat"
SectionEnd
