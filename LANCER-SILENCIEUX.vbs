Const ForAppending = 8
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
Set ShellApp = CreateObject("Shell.Application")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
errFile = appDir & "\GestiComService.err"

Sub LogErr(msg)
  On Error Resume Next
  Set f = fso.OpenTextFile(errFile, ForAppending, True)
  f.WriteLine Now & " [VBS] " & msg
  f.Close
End Sub

' 1. Serveur deja en ligne ? → ouvre immediatement
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.open "GET", "http://127.0.0.1:3001/", False
http.Send
If Err.Number = 0 And http.Status = 200 Then
  ShellApp.ShellExecute "http://localhost:3001", "", "", "open", 1
  WScript.Quit
End If
On Error GoTo 0

' 2. Lancer le serveur (service Windows ou direct)
Set exec = WshShell.Exec("sc query GestiComPro")
output = exec.StdOut.ReadAll()
serviceRunning = InStr(output, "RUNNING") > 0

If serviceRunning Then
  LogErr "Service deja en ligne"
ElseIf InStr(output, "SERVICE_NAME") > 0 Then
  LogErr "Demarrage du service..."
  WshShell.Run "net start GestiComPro", 0, True
Else
  ' Fallback: lancement direct
  launcherPath = appDir & "\scripts\standalone-launcher.js"
  If fso.FileExists(launcherPath) Then
    LogErr "Lancement direct du serveur..."
    WshShell.Run "node """ & launcherPath & """", 0, False
  End If
End If

' 3. Attendre le serveur (max 60s, check toutes les 500ms)
For i = 1 To 120
  WScript.Sleep 500
  On Error Resume Next
  Set http2 = CreateObject("MSXML2.XMLHTTP")
  http2.open "GET", "http://127.0.0.1:3001/", False
  http2.Send
  If Err.Number = 0 And http2.Status = 200 Then
    ShellApp.ShellExecute "http://localhost:3001", "", "", "open", 1
    LogErr "Application ouverte dans le navigateur (apres " & (i/2) & "s)"
    WScript.Quit
  End If
  On Error GoTo 0
Next

LogErr "Serveur non disponible apres 60s"
