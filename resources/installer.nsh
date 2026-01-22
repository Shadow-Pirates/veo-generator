!macro preInit
!macroend

Function .onVerifyInstDir
trim_tail:
  StrLen $0 "$INSTDIR"
  IntCmp $0 3 done_trim
  IntOp $1 $0 - 1
  StrCpy $2 "$INSTDIR" 1 $1
  StrCmp $2 "\\" 0 done_trim
  StrCpy $INSTDIR "$INSTDIR" $1
  Goto trim_tail

done_trim:
  StrLen $0 "$INSTDIR"
  StrLen $1 "交绘AI"
  IntCmp $0 $1 0 +2 +2
  Goto append

  StrCpy $2 "$INSTDIR" $1 -$1
  StrCmp $2 "交绘AI" done

append:
  StrCpy $INSTDIR "$INSTDIR\交绘AI"

done:
FunctionEnd
