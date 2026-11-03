; Mingrx 3.0 migration cleanup.
; The stable App ID stays unchanged so NSIS upgrades the existing installation.
!macro customInstall
  Delete "$DESKTOP\Banana Cord.lnk"
  Delete "$SMPROGRAMS\Banana Cord.lnk"
!macroend
