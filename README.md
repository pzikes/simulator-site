# Simulátor počítačové sítě

Samostatná vzdělávací webová aplikace vytvořená pomocí HTML, CSS, JavaScriptových ES modulů a SVG. Nepoužívá frameworky ani externí knihovny.

## Spuštění

V této složce spusť místní webový server, například:

```powershell
python -m http.server 8000
```

Otevři `http://localhost:8000`. ES moduly nefungují spolehlivě při otevření HTML souboru přímo z disku.

## Ovládání

- Tlačítky v levém panelu přidáš počítač, switch, router nebo server.
- Název zařízení můžeš zadat před přidáním; jinak se vytvoří automaticky.
- Zařízení vybereš kliknutím. Myší, dotykem nebo tlačítky se šipkami v panelu ho můžeš přesunout.
- Vybrané zařízení odstraníš tlačítkem v panelu.
- Klávesnice: Tab přejde na zařízení, Enter nebo mezerník ho vybere, šipky ho posunou a Delete ho odstraní.

Pracovní plocha používá pevný SVG `viewBox` 1000 × 600. Souřadnice zařízení zůstávají uvnitř plochy i při přesouvání. Každé zařízení je uloženo v modelu odděleném od DOM jako uzel s unikátním ID, typem, názvem a souřadnicemi. Model má také pole hran připravené pro další etapu; kabely ani přenos paketů zatím aplikace neimplementuje.

## Testy

Testy používají vestavěný nástroj Node.js `node:test` a nevyžadují instalaci závislostí. V této složce spusť:

```powershell
npm.cmd test
```

Pokryto je vytváření a validace uzlů, unikátní ID, ohraničení souřadnic, přesun a odstraňování uzlů včetně navázaných hran.
