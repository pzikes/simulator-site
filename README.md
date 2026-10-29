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
- Kabel vytvoříš zapnutím režimu propojení a výběrem dvou zařízení. Spojení jsou neorientovaná; opakovaný kabel ani připojení zařízení k sobě není povoleno.
- Kabel vybereš kliknutím na jeho spojnici a odstraníš tlačítkem **Odstranit vybraný kabel**. Při odstranění zařízení se odstraní i jeho kabely.
- Klávesnice: Tab přejde na zařízení, Enter nebo mezerník ho vybere, šipky ho posunou a Delete ho odstraní. V režimu propojení Enter nebo mezerník vybírá koncová zařízení; Escape režim ukončí. Kabel lze také vybrat klávesnicí a odstranit klávesou Delete nebo tlačítkem v panelu.
- V části **Přenos paketu** zvol odesílatele a příjemce a stiskni **Odeslat paket**. Nejkratší trasa se zvýrazní, paket po ní postupuje po jednotlivých kabelech a průběh vypisuje navštívená zařízení. Tlačítkem **Přerušit přenos** můžeš animaci zastavit.

Pracovní plocha používá pevný SVG `viewBox` 1000 × 600. Souřadnice zařízení zůstávají uvnitř plochy i při přesouvání. Každé zařízení je uloženo v modelu odděleném od DOM jako uzel s unikátním ID, typem, názvem a souřadnicemi. Kabely jsou neorientované hrany s ID koncových zařízení; jejich vykreslené pozice se aktualizují při přesunu zařízení. Paket hledá nejkratší cestu pomocí BFS a animuje se po nalezených hranách. Jde o zjednodušený grafový model, nikoli úplnou simulaci síťových protokolů; neřeší například IP/MAC adresování ani skutečné chování zařízení.

## Testy

Testy používají vestavěný nástroj Node.js `node:test` a nevyžadují instalaci závislostí. V této složce spusť:

```powershell
npm.cmd test
```

Pokryto je vytváření a validace uzlů a spojení, unikátní ID, odmítnutí smyček a duplicitních kabelů bez ohledu na pořadí konců, ohraničení souřadnic, přesun a odstraňování zařízení včetně navázaných kabelů. Testy hledání cesty pokrývají nejkratší trasu, neexistující cestu, shodný zdroj a cíl, cyklický graf a neměnnost vstupních polí.
