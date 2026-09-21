# Préanalyse hors API — 21 septembre 2026

## État vérifiable

- 1 017 sources vidéo interrogées par HTTP HEAD ; 1 017 descriptions de génération récupérées.
- Ces descriptions expriment une intention de génération. Elles ne prouvent pas le contenu réel des images et restent explicitement non vérifiées.
- 48 clips examinés directement sur quatre images chacun, à 8 %, 34 %, 64 % et 90 % de leur durée : 192 images. Ce contrôle échantillonné ne constitue pas une lecture intégrale ni un contrôle audio.
- 48 accroches réécrites individuellement pour la réaction observée, avec placement et traitement typographique associés, intégrées à la landing page.
- 969 clips restent à examiner visuellement. Leurs accroches promotionnelles existantes sont conservées ; elles ne sont pas présentées comme des analyses visuelles.
- Aucun appel à une API de modèle ou d'embedding pour ce travail. Aucun vecteur artificiel ni validation de géométrie inventée.

## Fichiers et reprise

`data/video-source-metadata.json` conserve URL, hash, ETag, taille et prompt source. `data/video-manual-reviews.json` conserve notes d'observation, réaction, accroche, design, placement, durée, temps des quatre échantillons et empreintes SHA-256 des images. `data/video-review-summary.json` expose les compteurs sans charger les descriptions dans la landing page.

1. Actualiser les métadonnées : `python scripts/catalogue-metadata.py`.
2. Préparer le prochain lot : `python scripts/review-video-frames.py --start 49 --end 96 --out /chemin/vers/revue` (Python, Pillow, curl, FFmpeg et FFprobe nécessaires).
3. Examiner les planches. Enregistrer les observations réelles dans le fichier de revue, sans dériver de faits visuels des prompts.
4. Exécuter `node scripts/apply-reviewed-hooks.js`, puis `npm test && npm run check`.

Les téléchargements sont vérifiés contre la taille source et écrits via un fichier temporaire. Une extraction sans image échoue explicitement. Un téléchargement local partiel a été corrigé pendant la revue ; cela ne démontre pas que la source distante est corrompue.

## Arrêt des traitements payants automatiques

Les trois crons Vercel sont retirés. Le module de préanalyse n'importe plus de client de modèle ni d'embedding. Les commandes administrateur de lancement et de traitement répondent `OFFLINE_PREANALYSIS_ONLY` après authentification. Les anciens endpoints cron ne peuvent plus réactiver un job. Les anciens enregistrements de la base sont conservés ; le statut de santé distingue leur historique du mode hors ligne actuel.

La génération personnalisée de textes et les autres fonctionnalités IA du produit ne sont pas remplacées par cette revue. Les validations strictes d'export restent inchangées : un choix de placement éditorial pour la landing ne vaut pas validation automatique d'export.

## Validation

La préversion a été ouverte dans le navigateur : les miniatures et le lecteur affichent le hook complet. La molette avance de la vidéo 1 à la vidéo 2 ; le bouton précédent revient à la vidéo 1 ; Échap ferme le lecteur. Les tests de contrat vérifient les 1 017 accroches, l'identité des sources des revues et l'absence de dépendance fournisseur sur les chemins de préanalyse.

L'audit initial de 121 points reste dans `docs/audit-reaction-hooks-2026-09-20.md`. Cette livraison ne signifie pas que les 121 points sont tous résolus, ni que la promesse commerciale de délai a été mesurée sur une génération complète.
