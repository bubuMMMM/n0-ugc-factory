# Audit du lecteur kebab — 21 septembre 2026

Périmètre : page /kebab, catalogue, fichiers joints, navigation vidéo et points de jonction du questionnaire. Ce document ne constitue pas un audit exhaustif de toutes les API du projet.

## Causes confirmées

1. **Erreur JavaScript fatale après le passage aux 98 aperçus.** Le HTML ne contient plus `featuredCard`, mais le script appelle `featuredCard.addEventListener`. Observé dans le navigateur : `Cannot read properties of null (reading 'addEventListener')`, 0 carte affichée. Comme les gestionnaires du questionnaire étaient plus bas dans la même fonction, ils ne s'initialisaient pas non plus.
2. **Données vidéo corrompues.** Les quatre `kebab-video/part0*.txt` concaténés donnent 42 191 caractères, dont 42 189 caractères Base64 hors padding : longueur invalide. `atob` ne peut pas reconstruire un MP4. Les trois fichiers joints originaux sont des MP4 H.264 valides d'environ 10 secondes.
3. **Deux circuits d'intégration incompatibles.** La vidéo spéciale utilisait quatre requêtes texte + décodage Base64 + Blob, tandis que le catalogue principal utilisait des URL directes. Ajouter un fichier ne suffisait pas à l'inscrire dans le catalogue.
4. **Les deux autres fichiers joints n'étaient pas référencés dans la page auditée.** Le dépôt comportait uniquement l'ancien média spécial et la liste historique.

## Autres incohérences du lecteur corrigées

5. Erreurs de lecture avalées avec `catch(function(){})`, sans action visible pour l'utilisateur.
6. Aucun poster pour les médias ajoutés ; écran noir pendant le chargement ou après un échec.
7. Compteur `index+2` / `videos.length+1` et navigation spéciale vers une vidéo inexistante.
8. La vidéo spéciale était hors catalogue : suppression possible par `resetFilter`, décompte et limite des aperçus divergents.
9. `cache: force-cache` pour un catalogue modifiable : risque de conserver une ancienne liste. Remplacé par une revalidation HTTP.
10. La grille continuait à lire derrière le lecteur plein écran. Désormais pause pendant le lecteur, le questionnaire et lorsque l'onglet est masqué.
11. Lecture lancée dans une marge de 260 pixels hors écran. Désormais lecture seulement lorsque la carte est visible.
12. Les états « cartes insérées » et « vidéos effectivement téléchargées » étaient confondus dans le message « chargées ». Désormais « aperçus disponibles — lecture au défilement ».
13. Hooks composés mécaniquement de fragments incompatibles, par exemple « Le kebab que ton nouveau kebab préféré ». Remplacés par des phrases complètes ; les deux nouveaux clips sans texte ont chacun leur hook.
14. Aucun attribut explicite pour signaler un hook déjà incrusté. La vidéo réaction utilise désormais `embeddedText: true`, sans hook ni dégradé ajouté par-dessus.
15. Décalage potentiel des métadonnées de placement après ajout de vidéos en tête : l'index d'origine des vidéos historiques est conservé pour ces métadonnées.
16. Absence de contrôle des doublons et des lignes vides/inutilisables du catalogue. Déduplication des URL et validation HTTPS avant ajout.
17. Couplage lecteur/questionnaire dans une seule initialisation. Deux scripts distincts ; une erreur de galerie n'interrompt plus l'installation du questionnaire.
18. Focus clavier non géré dans la fenêtre vidéo. Ajout du rôle dialogue, focus au bouton Fermer, confinement du focus, retour à la carte après fermeture.
19. Absence de garde contre la corruption des MP4 et les références HTML supprimées. Tests Node ajoutés et vérification intégrale des trois médias par FFmpeg.

## Comportement attendu après correction

- 98 aperçus maximum : les 3 vidéos kebab jointes, puis 95 vidéos du catalogue historique.
- Même constructeur de carte et même lecteur pour tous les médias.
- MP4 H.264/yuv420p avec métadonnées au début (`faststart`), servis directement. Les copies web sont muettes pour l'aperçu ; les fichiers originaux restent intacts.
- Lecture automatique muette, en boucle, dans la page. En cas de refus du navigateur : action manuelle visible.
- Les 3 vidéos restent disponibles même si le chargement de `videos.txt` échoue.
- Vidéo réaction sans texte ajouté ; préparation et dégustation dans la rue avec un hook.
- Questionnaire, limite de 98 aperçus et offre à 129 € conservés.

## Points distincts repérés, hors correction de lecture

- `/kebab/success` affirme « Paiement confirmé » sur une page statique, sans vérifier la session Stripe. La visite de cette page seule ne prouve pas un paiement.
- `api/kebab-checkout.js` crée une session et place le brief dans les métadonnées, mais ce chemin ne contient pas de lancement de génération ni de livraison des 1 020 vidéos. Ne pas confondre encaissement et livraison automatique.
- Validation serveur du questionnaire limitée ; pas de validation explicite de l'email, des champs obligatoires ni de clé d'idempotence dans cette API.
- Les plateformes choisies sont enregistrées dans le brouillon mais ne sont pas restaurées par `restoreDraft`.
- Les boutons Suivant du questionnaire n'appliquent pas de validation étape par étape.
- Le lecteur d'aperçu ne grave pas les hooks dans les fichiers MP4 : il les superpose à l'écran. Le rendu/export final est un circuit séparé.
- Le catalogue contient 3 médias kebab dédiés et une sélection de vidéos historiques, pas 98 tournages kebab originaux.

## Vérifications

- Trois sources originales : H.264/yuv420p, environ 10 secondes chacune.
- Décodage intégral FFmpeg des trois MP4 web : aucune erreur.
- Tests Node : références DOM présentes ; fichiers MP4 et posters présents ; boîtes MP4 complètes ; `moov` avant `mdat`.
- Empreintes Git des binaires téléversés comparées aux empreintes locales, identiques.
