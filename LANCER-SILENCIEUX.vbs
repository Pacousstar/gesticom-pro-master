Const ForAppending = 8
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
Set ShellApp = CreateObject("Shell.Application")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
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
  MsgBox "GestiCom Pro - Erreur:" & vbCrLf & vbCrLf & msg, vbExclamation, "GestiCom Pro"
End Sub

Log "Ouverture GestiCom Pro"

' 1. Verifier si serveur deja en ligne
On Error Resume Next
Set httpReady = CreateObject("MSXML2.XMLHTTP")
httpReady.open "GET", "http://127.0.0.1:3001/", False
httpReady.Send
If Err.Number = 0 And httpReady.Status = 200 Then
  Log "Serveur deja en ligne, ouverture navigateur"
  ShellApp.ShellExecute "http://localhost:3001", "", "", "open", 1
  WScript.Quit
End If
On Error GoTo 0

' 2. Chercher le serveur : soit service Windows, soit processus existant
serverLance = False

' 2a. Verifier le service Windows
On Error Resume Next
Set exec = WshShell.Exec("sc query GestiComPro")
output = exec.StdOut.ReadAll()
serviceExiste = (InStr(output, "SERVICE_NAME") > 0)
serviceRunning = (InStr(output, "RUNNING") > 0)

If serviceExiste And Not serviceRunning Then
  Log "Demarrage du service..."
  WshShell.Run "net start GestiComPro", 0, True
  WScript.Sleep 3000
  Set exec2 = WshShell.Exec("sc query GestiComPro")
  output2 = exec2.StdOut.ReadAll()
  If InStr(output2, "RUNNING") > 0 Then
    serverLance = True
  End If
ElseIf serviceRunning Then
  serverLance = True
End If

' 2b. Fallback: lancer le serveur directement si pas de service
If Not serverLance Then
  launcherPath = appDir & "\scripts\standalone-launcher.js"
  If fso.FileExists(launcherPath) Then
    Log "Lancement direct du serveur (sans service)..."
    WshShell.Run "node """ & launcherPath & """", 0, False
    WScript.Sleep 5000
    serverLance = True
  End If
End If

If Not serverLance Then
  Err "Impossible de demarrer le serveur. Verifiez que node.exe existe dans " & appDir
  WScript.Quit
End If

' 3. Attendre que le serveur reponde (HTTP 200)
serveurPret = False
For i = 1 To 45
  WScript.Sleep 2000
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:3001/", False
  http.Send
  If Err.Number = 0 And http.Status = 200 Then
    serveurPret = True
    Exit For
  End If
  On Error GoTo 0
Next

If serveurPret Then
  ShellApp.ShellExecute "http://localhost:3001", "", "", "open", 1
  Log "Application ouverte dans le navigateur"
Else
  Err "Le serveur ne repond pas apres 90s. Ouvrez http://localhost:3001 manuellement."
End If

Log "Termine"
