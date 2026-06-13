Const ForAppending = 8
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

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
End Sub

Log "Ouverture GestiCom Pro"

' Verifier si le serveur est deja en ligne
Set httpReady = CreateObject("MSXML2.XMLHTTP")
On Error Resume Next
httpReady.open "GET", "http://127.0.0.1:3001/", False
httpReady.Send
If httpReady.Status >= 200 And httpReady.Status < 500 Then
  Log "Serveur deja en ligne, ouverture navigateur"
  WshShell.Run "rundll32 url.dll,FileProtocolHandler http://localhost:3001", 0, False
  WScript.Quit
End If
On Error GoTo 0

' Verifier que le service Windows existe
Set exec = WshShell.Exec("sc query GestiComPro")
output = exec.StdOut.ReadAll()
If InStr(output, "SERVICE_NAME") = 0 Then
  Err "Service GestiComPro introuvable"
  WshShell.Run "rundll32 url.dll,FileProtocolHandler http://localhost:3001", 0, False
  WScript.Quit
End If

' Demarrer le service si besoin
If InStr(output, "RUNNING") = 0 Then
  Log "Demarrage du service..."
  WshShell.Run "net start GestiComPro", 0, True
End If

' Verifier si .migrated existe
flagFile = appDir & "\.migrated"
isFirstLaunch = Not fso.FileExists(flagFile)

If isFirstLaunch Then
  maxAttempts = 150
  Log "Premier demarrage (attente jusqu'a 5 min)"
Else
  maxAttempts = 30
End If

' Attendre que le serveur reponde
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
  WshShell.Run "rundll32 url.dll,FileProtocolHandler http://localhost:3001", 0, False
  Log "Application ouverte dans le navigateur"
Else
  Err "Serveur non disponible apres " & maxAttempts & " tentatives"
  If isFirstLaunch Then
    Err "La migration de la base de donnees a peut-etre echoue"
  End If
  WScript.Sleep 5000
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:3001/", False
  http.Send
  If http.Status >= 200 And http.Status < 500 Then
    WshShell.Run "rundll32 url.dll,FileProtocolHandler http://localhost:3001", 0, False
    Log "Ouverture differee reussie"
  Else
    Err "Echec definitif"
  End If
  On Error GoTo 0
End If

Log "Termine"
