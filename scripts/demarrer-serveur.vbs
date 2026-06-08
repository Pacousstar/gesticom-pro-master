Const ForAppending = 8
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

appDir = "C:\GestiComPro"
logFile = appDir & "\GestiComService.out"
errFile = appDir & "\GestiComService.err"

Sub Log(msg)
  On Error Resume Next
  Set f = fso.OpenTextFile(logFile, ForAppending, True)
  f.WriteLine Now & " [VBS] " & msg
  f.Close
End Sub

Sub Err(msg)
  On Error Resume Next
  Set f = fso.OpenTextFile(errFile, ForAppending, True)
  f.WriteLine Now & " [VBS] ERREUR: " & msg
  f.Close
End Sub

Log "Demarrage serveur GestiCom Pro"

If Not fso.FileExists(appDir & "\node.exe") Then
  Err "node.exe introuvable dans " & appDir
  WScript.Quit 1
End If

' Tuer tout processus node residu
On Error Resume Next
WshShell.Run "taskkill /F /IM node.exe /T", 0, True
On Error GoTo 0

cmd = """" & appDir & "\node.exe"" """ & appDir & "\scripts\standalone-launcher.js"""
WshShell.Run cmd, 0, False

Log "Serveur lance en mode cache"

' Attendre que le serveur reponde (max 5 min pour premiere migration)
maxAttempts = 150
serveurPret = False
For i = 1 To maxAttempts
  WScript.Sleep 2000
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:3001/", False
  http.Send
  If http.Status >= 200 And http.Status < 500 Then
    serveurPret = True
    Exit For
  End If
  On Error GoTo 0
Next

If serveurPret Then
  WshShell.Run "cmd /c start http://localhost:3001", 0, False
  Log "Application ouverte dans le navigateur"
Else
  Err "Serveur non disponible apres " & maxAttempts & " tentatives"
End If

Log "Termine"
