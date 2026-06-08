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

Log "Demarrage"

' Verifier que node.exe existe
If Not fso.FileExists(appDir & "\node.exe") Then
  Err "node.exe introuvable dans " & appDir
  WScript.Quit 1
End If

' Verifier si le serveur est deja en ligne
Set httpReady = CreateObject("MSXML2.XMLHTTP")
On Error Resume Next
httpReady.open "GET", "http://127.0.0.1:3001/", False
httpReady.Send
If httpReady.Status >= 200 And httpReady.Status < 500 Then
  Log "Serveur deja en ligne, ouverture navigateur"
  WshShell.Run "cmd /c start http://localhost:3001", 0, False
  WScript.Quit
End If
On Error GoTo 0

' Verifier si .migrated existe
flagFile = appDir & "\.migrated"
isFirstLaunch = Not fso.FileExists(flagFile)

If isFirstLaunch Then
  maxAttempts = 150 ' 150 * 2s = 5 min
  Log "Premier demarrage : migration en cours (attente jusqu'a 5 min)"
Else
  maxAttempts = 30 ' 30 * 2s = 60s
  Log "Demarrage normal"
End If

' Tuer tout processus node residu
On Error Resume Next
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "taskkill /F /IM node.exe /T", 0, True
On Error GoTo 0

Log "Lancement du serveur..."

' Lancer le serveur (fenetre completement cachee)
cmd = """" & appDir & "\node.exe"" """ & appDir & "\scripts\standalone-launcher.js"""
WshShell.Run cmd, 0, False

Log "node.exe lance, attente du serveur..."

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
    Log "Serveur pret (status " & http.Status & "), ouverture navigateur"
    Exit For
  End If
  On Error GoTo 0
Next

If serveurPret Then
  WshShell.Run "cmd /c start http://localhost:3001", 0, False
  Log "Application ouverte dans le navigateur"
Else
  Err "Serveur non disponible apres " & maxAttempts & " tentatives"
  If isFirstLaunch Then
    Err "La migration de la base de donnees a peut-etre echoue"
  End If
  ' Derniere tentative apres 5s supplementaires
  WScript.Sleep 5000
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:3001/", False
  http.Send
  If http.Status >= 200 And http.Status < 500 Then
    WshShell.Run "cmd /c start http://localhost:3001", 0, False
    Log "Ouverture differee reussie"
  Else
    Err "Echec definitif"
  End If
  On Error GoTo 0
End If

Log "Termine"
