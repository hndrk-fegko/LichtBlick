Admin vorschau: 
- position des Spotlights relativ zur Box:
    füllt das Bild nicht die ganze Box aus, wird das Spotlight auf dem Bild nicht relattiv zum angezeigten Bild, sondern relativ zur Box positioniert.Effekt: das Spotlight erscheint nicht immer an der position des Mauszeigers, sondern wandert je nach Bildgröße innerhalb der Box. (in der Mitte es Bildes ist es also ok, am Rand nicht)
    Spotlight soll immer an der position des Mauszeigers erscheinen, auch wenn das Bild nicht die ganze Box ausfüllt.
- Markierung komplett auf gedeckter Bereiche: 
    ist die Transparenz der abgeckenden/maskierenden ebene an einer stelle 100%, soll auf dieser Fläche optional 90%tranparent grün maskiert werden. Dieser effekt ist im moment stapebar - soll nicht stapelbar sein, da nicht mehr als 100% transparenz erreicht werden kann.
- Spotlight in der Adminvorschau wwird weiß. meine Vermutung: Schau dir die Reiehenfolge der Ebenen an. Bild wird angezeig. darüber eine schwaze Ebene (Abdeckende Ebene). nur Diese wird durch das Spotlight schritt für schritt transparent gemacht. (für die Vorschau könnte noch eine Ebene dazukommen, die das Spotlight darstellt.  Kann aber auch über eine Lice berechnung der transparenten Ebene, die nicht mit dem Bemaer synchronisiert ist, gelöst werden.)
- Radius des Spotlights kann eingestellt werden. Stärke des Spotlights sollte auch einstellbar sein. (ein Klick fügt x Prozent transparenz hinzu). Focus des Spotlights sollte auch einstellbar sein (wie groß ist im Verhältnis (y %) der Bereich in dem die stärke komplett angewendet wird? von diesem Radius aus wird die stärke dann immer weiter reduziert bis zum äußeren Radius des Spotlights.) 

Beamer
    - Beamer zeigt bis zum Button aufdecken nur schwarz an. Spotlight werden nicht synchronisiert oder falsch angewendet. 
    - Testen: rendert der Beamer alle Spotlights nach, wenn er erst später gestartet wird? (also werden die Sotlights in der Datenbank gespeichert oder nur live synchronisiert?)
    ich hab keine favorisierte Lösung - es muss nur dem Bediener angezeigt werden z.B. durch einen tooltip auf "Spotlights löschen" dass man damit z.B. nach einem Verbindungsabbruch zum Bemaer die Spotlights zwischen beiden wieder synchronisieren (=zurücksetzten) kann.
