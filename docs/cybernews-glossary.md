# Dansk cyber-glossary (in-optimizer cyber-news)

Brug under oversættelse fra engelsk til simpelt dansk i `/in-optimize:cyber-news`-skillen. Hvis et udtryk ikke står her, vælg den mest gængse danske form blandt sikkerhedsfolk og tilføj det her bagefter.

Tone: simpelt og direkte. Læseren er en travl dansk leder eller udvikler — ikke en specialist. Ingen tankestreger (humanizer-da-reglen).

## Kerne-termer

| Engelsk | Dansk (foretrukket) | Note |
|---|---|---|
| zero-day | nul-dags-sårbarhed | Forklar første gang: "en ukendt sårbarhed" |
| 0-day | nul-dags-sårbarhed | Samme som zero-day |
| in-the-wild / actively exploited | aktivt udnyttet | "udnyttes lige nu af angribere" |
| RCE / remote code execution | fjernkørsel af kode | Eller: "angriber kan køre kode på maskinen" |
| arbitrary code execution | vilkårlig kodekørsel | Lidt teknisk, oversæt løst |
| pre-auth / unauthenticated | uden login | "kræver ikke at angriberen er logget ind" |
| privilege escalation | rettigheds-eskalering | Eller: "angriber bliver til administrator" |
| LPE (local privilege escalation) | lokal rettigheds-eskalering | |
| wormable | spredende | Forklar: "kan sprede sig automatisk fra maskine til maskine" |
| supply-chain attack | forsynings-kæde-angreb | Eller: "angreb gennem en leverandør" |
| typosquatting | typo-pakker | "skrivefejl-pakker der ligner ægte" |
| dependency confusion | afhængigheds-forvirring | |
| malware | malware | Brug det engelske ord, det er etableret |
| infostealer / stealer | data-tyv | "malware der stjæler kodeord og cookies" |
| ransomware | løsesum-virus | Eller: "ransomware" hvis kontekst er teknisk |
| data breach / breach | databrud | |
| data leak | datalæk | |
| phishing | phishing | Etableret |
| smishing | sms-phishing | |
| vishing | telefon-phishing | |
| social engineering | social manipulation | |
| C2 / command and control | styringsserver | "den server angriberen styrer fra" |
| backdoor | bagdør | |
| nation-state actor / APT | statslig aktør | |

## Patches og produkter

| Engelsk | Dansk |
|---|---|
| patch | rettelse / patch | Begge er fine |
| advisory | sikkerhedsmeddelelse |
| disclosure | offentliggørelse |
| coordinated disclosure | koordineret offentliggørelse |
| Patch Tuesday | månedens Microsoft-rettelser |
| EOL / end-of-life | udløbet support |

## Severity-fraser (genbruges i LinkedIn-versionerne)

- **zero-day**: "Lige nu udnyttes …"; "Patch er ude. Hvis du kører X, opdater i dag."
- **critical**: "Kritisk hul i …"; "Hvis du driver X, planlæg patching denne uge."
- **notable**: "Værd at vide:"; "Hvad det betyder for danske virksomheder:"
- **info**: "Lille kontekst:"; "Et tema vi ser oftere:"

## Stil-noter

- Skriv "X" eller "Microsoft", ikke "@Microsoft" (LinkedIn håndterer @-tags ringe).
- Skriv CVE-numre rene: "CVE-2026-1234", ingen kursiv eller link-formatering.
- Hvis tweetet har et link, behold det i bunden af LinkedIn-posten under hashtags.
- Behold tal og produktnavne fra originalen. Oversæt ikke produktnavne ("Outlook" forbliver "Outlook").
- Ingen tankestreger. Ingen "—". Ingen " - " som pause-markør.
