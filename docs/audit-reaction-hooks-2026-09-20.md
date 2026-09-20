# Audit et corrections — videoma / n0-ugc-factory

Référence étudiée : `76e770ab44e0928e44052b34f4f1a7a5f4216291`, branche main, le 20 septembre 2026. Branche de travail : `codex/reaction-hooks-gallery-audit`.

## Résultat et limites

La cause de la disparition/troncature des hooks est confirmée dans le code : opacité nulle lorsque la géométrie manque, clamp final à une ligne et rectangle trop petit. Les corrections de la branche remplacent ces règles par un rendu intégral avec mesure du texte, trois styles et bandeau extérieur seulement lorsque nécessaire. Le lecteur reçoit navigation verticale, boutons, clavier et gestion du focus.

La demande éditoriale finale est respectée dans le catalogue : **1 017 variations promotionnelles distinctes**, toutes de **13 à 25 mots**, toutes centrées sur **1 000 vidéos en 5 minutes à partir du lien du site**. Elles ne constituent pas 1 017 concepts indépendants : elles déclinent 32 entrées de réaction et 32 formulations de la même promesse. Elles ne sont pas encore validées visuellement une par une sur les clips. La promesse de temps n’a pas été mesurée.

**État de livraison : code proposé sur une branche ; pas une correction annoncée comme déployée en production.** L’environnement d’exécution et le navigateur se sont déconnectés pendant le travail. La récupération par le connecteur GitHub a permis de préparer et contrôler la syntaxe des fichiers, mais pas d’exécuter npm, FFmpeg ni la validation visuelle finale. Ne pas fusionner sans ces contrôles.

Le périmètre comprend les routes API, modules de génération/QA/layout/rendu, frontend, jobs et contrats de schéma examinés, avec comparaison au précédent audit. Cette revue du code n’est pas un test complet de chaque chemin d’exécution ; les constats statiques, corrections proposées, limites de production et contrôles restant à faire sont distingués ci-dessous.

## Production constatée

Lecture de [l’état de service](https://n0-ugc-factory.vercel.app/api/health) via Vercel durant cette session :

| Indicateur | Valeur |
|---|---|
| Catalogue | 1 017 |
| Analyses ready historiques | 85 |
| Analyses compatibles avec la version actuelle | 0 |
| Analyses géométriques actuelles valides | 0 |
| En attente | 932 |
| En cours | 0 |
| Job actif | Non |
| Erreur de blocage | OPENAI_API_INSUFFICIENT_FUNDS |
| Stripe | Non configuré |
| Stockage MP4 persistant | Non configuré |
| Rendu direct | Déclaré configuré ; pas testé sur un vrai MP4 pendant cette session |

Le précédent audit indiquait l’absence d’export et de protections de projet. Ces fonctionnalités sont maintenant présentes dans le code. Il serait incorrect de présenter les mêmes constats comme toujours entièrement absents. En revanche, leur présence ne prouve pas la livraison de 1 000 vidéos en cinq minutes.

## Contrôles réalisés sur les changements

- Compilation JavaScript V8 de tous les modules modifiés et du script inline du frontend : réussie.
- Vérification du catalogue : 1 017 IDs consécutifs, 1 017 chaînes uniques, minimum six mots respecté, présence de la promesse et du site/lien/URL dans chaque texte.
- Route textuelle avec IA et projet simulés : indices non contigus 2, 7, 11 conservés, réponse HTTP 200.
- Validation de texte : accroche trop courte rejetée explicitement, texte valide conservé.
- Secours Gateway → OpenAI simulé : seconde tentative exécutée dans le budget restant.
- Calcul de rendu isolé : texte intégral conservé ; mot trop large rejeté au lieu de déborder.
- Contrôles non exécutés : npm test, serveur local de la version finale, gestes iPhone, screenshots de la version finale, rendu FFmpeg réel, SQL réel des corrections, paiement et pack complet.

**Légende :** « Corrigé dans la branche » signifie implémenté dans la proposition, et non validé en production. « À faire » identifie le travail restant. « À vérifier/mesurer » identifie un contrôle nécessaire sans affirmer un incident non reproduit.

## Hooks, rédaction et pertinence

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 001 | P1 | Corrigé dans la branche | Les trois routes de génération imposent au moins six mots et rejettent un hook trop long au lieu de le couper. | `api/_hook-text.js, hooks.js, video-hooks.js, hooks-intelligence.js` |
| 002 | P1 | Corrigé dans la branche | La landing dispose de 1 017 textes distincts. Chacun cite les 1 000 vidéos en 5 minutes et le lien, l’URL ou le site. | `assets/demo-hooks.js` |
| 003 | P1 | À valider éditorialement | Les 1 017 textes sont des variations combinatoires de 32 formulations et 32 entrées de réaction, pas 1 017 idées créatives indépendantes. Remplacer progressivement les variations les plus proches par des angles originaux. | `assets/demo-hooks.js` |
| 004 | P0 | Bloqué : analyses | Associer chaque hook à l’expression réelle de sa vidéo : surprise, scepticisme, soulagement, sourire, découverte. Le placement actuel du catalogue de démonstration est éditorial, pas une validation visuelle individualisée. | `api/video-layouts.js, assets/demo-hooks.js` |
| 005 | P1 | À faire | Créer un manifeste éditorial par vidéo : source stable, hook, intention, réaction attendue, preuve visuelle, durée de lecture, variante graphique, statut de validation. | `videos.txt, assets/demo-hooks.js` |
| 006 | P1 | Corrigé dans la branche | Refaire la comparaison entre les hooks du même lot au moment de l’acceptation finale, y compris après réécriture. | `api/hooks-intelligence.js, api/video-hooks.js` |
| 007 | P1 | À faire | Empêcher les doublons entre lots concurrents avec une réservation transactionnelle ou une contrainte de texte normalisé au niveau du projet. | `api/hooks-intelligence.js` |
| 008 | P1 | À faire | Comparer la totalité des 1 017 hooks au lieu de borner le contexte à 320 textes ; compléter Jaccard par une détection des accroches sémantiquement équivalentes. | `loadPackContext, tooSimilar` |
| 009 | P1 | À faire | Ne pas rejeter automatiquement deux hooks différents uniquement parce qu’ils commencent par les trois mêmes mots : ce test pénalise les hooks réactions naturels. | `api/video-hooks.js:tooSimilar` |
| 010 | P1 | À faire | Valider strictement les IDs, leur unicité, les champs et les bornes des réponses IA ; une réponse JSON structurée ne garantit pas tous les invariants métier. | `normalize, generate` |
| 011 | P1 | À faire | Traiter un hook trop court comme un candidat à réécrire, sans faire échouer tout le lot. Le correctif actuel le rejette explicitement. | `api/_hook-text.js, génération` |
| 012 | P1 | À faire | Conserver le meilleur candidat lors des révisions ; une nouvelle proposition ne doit pas remplacer un hook meilleur ou déjà validé. | `api/hooks-intelligence.js, video-hooks.js` |
| 013 | P1 | À faire | Lier le nombre de mots au temps réel de la vidéo. Une accroche lisible en miniature peut nécessiter trop de secondes de lecture. | `api/_video-frames.js, règles QA` |
| 014 | P1 | À faire | Retirer progressivement les anciennes banques et les templates locaux génériques désormais inutiles ; régénérer les anciens hooks clients de moins de six mots. | `index.html:SAFE_DEMO_HOOKS, DEMO_HOOK_LIBRARY, localPersonalizedHook` |
| 015 | P0 | À mesurer | Vérifier la promesse de 1 000 vidéos en 5 minutes sur le livrable annoncé. Le texte demandé est préparé ; aucun benchmark ne démontre encore cette performance. | `parcours complet` |

## Miniatures et design typographique

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 016 | P1 | Corrigé dans la branche | Supprimer les générations concurrentes de CSS qui imposent une ligne, des ellipses ou une hauteur tronquée. | `index.html, assets/reaction-gallery.css` |
| 017 | P1 | Corrigé dans la branche | Afficher les hooks sans attendre les analyses de visage : supprimer l’opacité nulle lorsque la géométrie manque. | `applyHookToCard, CSS` |
| 018 | P1 | Corrigé dans la branche | Proposer trois compositions cohérentes : blanc détouré, cartouche blanc, cartouche sombre avec accent clair. | `assets/reaction-gallery.css` |
| 019 | P1 | Corrigé dans la branche | Mesurer la hauteur et la largeur du texte, diminuer progressivement la police avec un seuil de lisibilité, puis afficher un bandeau extérieur si nécessaire. | `fitHookNode` |
| 020 | P1 | Corrigé dans la branche | Conserver le texte intégral et sa seconde ligne dans les miniatures, le lecteur et le presse-papiers. | `applyHookToCard, openVideo, copy` |
| 021 | P1 | Corrigé dans la branche | Autoriser le chevauchement éditorial du visage pour les exemples de landing, conformément à la demande. Le visage n’est plus un veto absolu pour ces aperçus. | `demoHookFor, metaFor` |
| 022 | P1 | À faire | Étendre cette politique aux exports de façon explicite : aperçu promotionnel et validation face-safe du rendu serveur restent deux politiques différentes. | `api/_layout.js, _renderer.js` |
| 023 | P1 | Corrigé dans la branche | Recalculer la composition au redimensionnement et après le chargement des polices. | `index.html:resize, document.fonts.ready` |
| 024 | P1 | Corrigé dans la branche | Passer la grille mobile à deux colonnes pour garder assez de largeur au texte. | `assets/reaction-gallery.css` |
| 025 | P1 | À vérifier visuellement | Tester les 1 017 accroches sur petits iPhone, Android, tablettes et bureau : aucun débordement, aucune collision avec les commandes, contraste et retours à la ligne agréables. | `galerie et lecteur` |
| 026 | P1 | À faire | Remplacer la variation cyclique des styles et positions par un choix guidé par la scène, le contraste local et la longueur réelle du texte. | `assets/demo-hooks.js` |
| 027 | P2 | À faire | Prévoir une mise en valeur limitée des mots 1 000, 5 minutes ou lien sans multiplier les couleurs et les polices dans un même hook. | `rendu typographique` |
| 028 | P1 | À faire | Partager exactement police, taille, couleur, rectangle et retours à la ligne entre aperçu et export. Aujourd’hui l’export reste blanc, avec son propre calcul. | `api/_renderer.js, frontend` |
| 029 | P1 | À faire | Utiliser les dimensions natives du média pour transformer les coordonnées de visage et de texte ; les contact sheets recadrées et le lecteur contain n’ont pas toujours le même repère. | `_video-frames.js, CSS` |
| 030 | P2 | À faire | Ajouter un éditeur unitaire : texte, placement libre, trois styles, taille contrôlée, réinitialisation, aperçu des zones et sauvegarde versionnée. | `éditeur` |
| 031 | P2 | À faire | Fournir de vrais posters légers et prévoir un état propre lorsqu’un MP4 ne peut pas charger. | `catalogue média` |
| 032 | P1 | Corrigé dans la branche | Le message d’erreur d’une miniature ne reste plus un squelette animé indéfiniment. | `render` |

## Lecteur, navigation et accessibilité

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 033 | P1 | Corrigé dans la branche | Navigation précédente/suivante à la molette avec seuil et temporisation anti-défilement excessif. | `lecteur` |
| 034 | P1 | Corrigé dans la branche | Navigation par geste vertical sur la zone vidéo ; préserver la bande de commandes natives et ignorer les gestes horizontaux. | `lecteur` |
| 035 | P1 | Corrigé dans la branche | Boutons précédent/suivant, compteur de position, flèches clavier et PageUp/PageDown ; désactivation aux bornes du catalogue. | `lecteur` |
| 036 | P1 | Corrigé dans la branche | Bloquer le scroll de la page derrière le lecteur et restaurer sa position à la fermeture. | `openVideo, closeModal` |
| 037 | P1 | Corrigé dans la branche | Conserver le focus de retour initial pendant la navigation, rendre le fond inerte et confiner Tab au lecteur. | `lecteur` |
| 038 | P1 | Corrigé dans la branche | Garder un seul élément vidéo principal et arrêter l’ancienne lecture avant de changer la source. | `openVideo` |
| 039 | P1 | Corrigé dans la branche | Afficher des états chargement, lecture bloquée et média indisponible tout en permettant de passer au clip suivant. | `readerStatus` |
| 040 | P1 | Corrigé dans la branche | Une régénération terminée après navigation ne rouvre plus automatiquement l’ancienne vidéo. | `regenerateOneHook` |
| 041 | P1 | Corrigé dans la branche | Corriger le filtre d’exclusion du hook actif : filtrer par index avant de supprimer les entrées vides. | `regenerateOneHook` |
| 042 | P1 | À vérifier | Tester les gestes sur Safari iOS, le clavier des contrôles natifs, VoiceOver, la touche Échap et les fonds inertes. | `tests navigateur` |
| 043 | P2 | À faire | Créer un lien d’aperçu partageable qui restitue le hook et le style ; le bouton actuel copie le MP4 source sans texte. | `copyLink` |
| 044 | P2 | À faire | Ajouter favoris, recherche, filtres de réaction, filtres de qualité, sélection et export par lot. | `catalogue` |
| 045 | P2 | À faire | Garder une fenêtre virtualisée du catalogue ou une pagination accessible. Le scroll infini accumule actuellement les cartes. | `render` |
| 046 | P2 | À faire | Ajouter un mode pause manuelle et mémoriser le choix audio entre les vidéos sans forcer l’autoplay sonore. | `lecteur` |

## Performances et coût

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 047 | P1 | Corrigé dans la branche | Limiter la lecture aux cartes réellement dans le viewport, et non aux cartes seulement dans la marge de préchargement. | `schedulePlayback` |
| 048 | P1 | Corrigé dans la branche | Respecter reduced-motion, interrompre les vidéos hors visibilité et libérer les sources des cartes détruites. | `CSS, schedulePlayback, render` |
| 049 | P1 | Corrigé dans la branche | Ne plus extraire des planches vidéo côté navigateur simplement pour rendre visibles les hooks de démonstration. | `render, schedulePlayback` |
| 050 | P2 | À faire | Retirer le code de scan local devenu inactif et ses dépendances de géométrie concurrentes. | `CLIENT_SAFE_LAYOUTS et fonctions associées` |
| 051 | P2 | À faire | Sortir les 1 017 URL du document initial et servir un manifeste versionné ; réduire le poids du HTML et des banques de textes inutilisées. | `index.html` |
| 052 | P2 | À faire | Versionner ou hasher les assets JS/CSS pour permettre un cache long sans mélange de versions après déploiement. | `assets, vercel.json` |
| 053 | P1 | À faire | Supprimer les listings Azure massifs de /api/videos au profit du manifeste autoritaire ; ajouter méthodes explicites et délais si cette route reste utile. | `api/videos.js` |
| 054 | P1 | Corrigé dans la branche | Partager un budget de temps entre Gateway et OpenAI : le fallback n’ajoute plus arbitrairement 90 secondes au délai demandé. | `api/_ai.js` |
| 055 | P1 | À faire | Étendre ce budget au parcours complet génération, QA et révision ; les évaluations par vidéo peuvent encore dépasser le temps de la fonction. | `api/_jev.js, génération` |
| 056 | P1 | À faire | Mettre en cache les embeddings de signaux et éviter de refaire le matching à chaque reprise de projet. | `api/match-videos.js` |
| 057 | P1 | À faire | Grouper les écritures SQL de signaux, matching et hooks. Un pack peut encore provoquer plus de mille aller-retours. | `match-videos.js, hooks-intelligence.js` |
| 058 | P2 | À mesurer | Mesurer la recherche vectorielle exacte contre un top-k indexable, puis choisir selon la qualité et le temps réel. | `CROSS JOIN et HNSW` |
| 059 | P1 | À faire | Enregistrer fournisseur réellement utilisé, tokens, coût, latence et identifiant de requête par étape. | `_ai.js, _embedding.js, _jev.js` |
| 060 | P1 | À faire | Évaluer l’intérêt du QA individuel pour chaque hook : la promesse de coût limité à l’analyse du site et aux hooks n’est pas respectée tant que des évaluations externes supplémentaires restent actives. | `_jev.js` |
| 061 | P2 | À mesurer | Mesurer la latence France → fonctions → PostgreSQL → médias avant de modifier la région d’exécution. | `Vercel et base` |

## Préanalyses, jobs et robustesse

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 062 | P0 | Bloqué : fournisseur | Rétablir des crédits utilisables puis reprendre les 932 clips en attente et les 85 analyses obsolètes. Les clés configurées ne prouvent pas la disponibilité. | `health de production` |
| 063 | P1 | Corrigé dans la branche | Réinitialiser le compteur d’essais et les baux lorsqu’une erreur est explicitement relancée ou qu’une nouvelle version d’analyse est demandée. | `admin/_preanalysis-core.js` |
| 064 | P1 | Corrigé dans la branche | Une panne de facturation ne consomme plus un essai métier et une pause ne libère plus les clips détenus par les autres workers. | `admin/_preanalysis-core.js` |
| 065 | P1 | Corrigé dans la branche | Traiter les erreurs réseau comme transitoires et faire sortir les baux périmés épuisés vers un état d’erreur explicite. | `admin/_preanalysis-core.js` |
| 066 | P1 | À faire | Empêcher les trois crons de créer simultanément plusieurs jobs actifs ; ajouter un verrou ou une contrainte d’unicité adaptée. | `ensureActiveJob, createJob` |
| 067 | P1 | À faire | Distinguer erreur partielle, sauvegarde refusée à cause d’un bail expiré et analyse réellement enregistrée ; contrôler rowCount avant d’ajouter une vidéo à saved. | `analyze dans _preanalysis-core.js` |
| 068 | P1 | À faire | Ne pas compter les vieux ready comme disponibles ; utiliser version, validité géométrique et embedding exploitable partout. | `counts, health, matching` |
| 069 | P1 | À faire | Valider localement les boîtes et leur repère temporel avant de persister une analyse permanente. | `schema et stockage préanalyse` |
| 070 | P1 | À faire | Échantillonner davantage les clips très mobiles et conserver un niveau de confiance explicite ; quatre images ne couvrent pas tout le mouvement. | `_video-frames.js` |
| 071 | P1 | À faire | Limiter les octets durant le téléchargement des sources et nettoyer les JPG si FFmpeg échoue avant la fin de contactSheet. | `_video-frames.js` |
| 072 | P1 | À faire | Mettre la génération utilisateur dans une file serveur persistante, avec reprise, annulation et consultation sans laisser l’onglet ouvert. | `generateMissing` |
| 073 | P1 | À faire | Rendre chaque étape idempotente par projet, vidéo, version de profil et version de prompt ; empêcher deux clients de générer le même travail. | `génération et schéma` |
| 074 | P1 | À faire | Arrêter les autres workers d’un pack quand l’un détecte une panne fournisseur bloquante, plutôt que laisser leurs requêtes continuer. | `generateMissing` |
| 075 | P1 | À faire | Ne pas présenter des hooks de secours locaux comme validés ou prêts à exporter ; montrer générés, acceptés, à revoir et livrés séparément. | `generateLocalProjectHooks, updateProgress` |
| 076 | P1 | À faire | Distinguer brouillon analysé et projet actif pour verrouiller toute la phase analyse/matching/génération, y compris les boutons de reprise. | `siteForm` |
| 077 | P2 | À faire | Recalculer les correspondances lors d’une reprise quand de nouvelles vidéos préanalysées sont devenues disponibles. | `continueHooks, project-state` |

## Données, sécurité et fiabilité API

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 078 | P0 | Corrigé dans la branche | Isoler le profil de chaque nouveau projet. Les snapshots source du cache sont séparés des profils modifiables ; un hit cache crée une copie privée. | `api/analyze.js` |
| 079 | P1 | Corrigé dans la branche | Indexer logiquement le cache par URL complète et version source au lieu du seul domaine, afin de distinguer les offres d’un même site. | `cachedBrandProfile` |
| 080 | P1 | À faire | Migrer ou révoquer les anciens projets qui partagent encore un brand_profile_id : l’isolation nouvelle ne répare pas rétroactivement ces tokens. | `generation_projects` |
| 081 | P1 | Corrigé dans la branche | Valider dimensions, indices et valeurs finies de chaque embedding avant insertion. | `api/_embedding.js` |
| 082 | P0 | À faire | Éviter les quotas permissifs en cas d’erreur de base. Plusieurs routes utilisent catch(() => ({allowed:true})) pour une opération coûteuse. | `routes IA, rendu, analyse` |
| 083 | P1 | À faire | Baser la limitation anonyme sur une identité stable : le user-agent est modifiable ; une variation ne doit pas ouvrir un nouveau quota. | `_project-auth.js:clientKey` |
| 084 | P1 | À faire | Prévoir nettoyage des fenêtres de rate limit, des tokens expirés, des projets et des rendus obsolètes. | `api_rate_limits, generation_projects` |
| 085 | P1 | À faire | Publier les nouveaux signaux et matches atomiquement et verrouiller le profil pendant le calcul ; ne pas exposer un matching partiellement réécrit. | `match-videos.js` |
| 086 | P1 | À faire | Limiter précisément tailles de payloads, tableaux, chaînes et images base64 avant toute requête IA. | `video-hooks.js et API` |
| 087 | P1 | À faire | Ajouter un délai total aux fetchs publics et à la résolution DNS ; setTimeout de socket protège surtout l’inactivité, pas tout le temps écoulé. | `_public-fetch.js` |
| 088 | P1 | À faire | Restreindre le proxy au catalogue connu, borner les redirections et annuler l’amont lorsque le client abandonne. | `video-proxy.js` |
| 089 | P1 | À faire | Gérer explicitement les erreurs des streams dans le proxy et le téléchargement de rendus. | `video-proxy.js, render-download.js` |
| 090 | P1 | À faire | Exiger une configuration d’origine canonique pour Checkout au lieu de reconstruire des URLs à partir des en-têtes client. | `checkout.js` |
| 091 | P2 | À faire | Déplacer les scripts inline puis déployer une CSP testée, sans casser polices, vidéos, appels IA et téléchargements. | `index.html, vercel.json` |
| 092 | P1 | À faire | Cesser d’exposer les messages bruts de base dans le health public ; garder un code générique et réserver les détails à l’administration. | `health.js` |
| 093 | P1 | À faire | Contrôler l’état fonctionnel, pas seulement la présence de clés : ok:true et ai:true coexistent actuellement avec le job bloqué. | `health.js` |
| 094 | P1 | À faire | Faire remonter un échec de persistance de profil au lieu de renvoyer un projet sans token utilisable. | `persistBrandProfile` |
| 095 | P2 | À faire | Documenter rotation/révocation des liens secrets de projet et ajouter une récupération durable par compte si nécessaire. | `_project-auth.js, reprise` |

## Exports et livraison commerciale

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 096 | P1 | Corrigé dans la branche | Désactiver l’expansion FFmpeg drawtext pour conserver les caractères % littéraux. | `api/_renderer.js` |
| 097 | P1 | Corrigé dans la branche | Refuser un mot plus large que le rectangle et ne plus supprimer silencieusement une seconde ligne trop large. | `api/_renderer.js` |
| 098 | P1 | À faire | Mesurer le texte avec les vraies métriques de la police plutôt que approxWidth ; vérifier visuellement les MP4 à accents, chiffres et mots longs. | `_renderer.js` |
| 099 | P1 | À faire | Empaqueter la police utilisée et contrôler la compatibilité du binaire FFmpeg ; ne pas dépendre d’un téléchargement de police à chaque démarrage froid. | `ensureRenderFont` |
| 100 | P1 | À faire | Ajouter une acquisition atomique du rendu ; le couple lecture puis upsert laisse deux requêtes démarrer le même calcul. | `render-video.js` |
| 101 | P1 | À faire | Annuler et nettoyer correctement fichiers et streams quand un téléchargement ou un rendu échoue ; contrôler les erreurs du write stream. | `_renderer.js:download` |
| 102 | P1 | À faire | Aligner durée totale téléchargement, police, probe et FFmpeg avec la limite de la fonction ; 240 s de FFmpeg ne laissent pas toujours assez de marge. | `render-video.js, render-direct.js` |
| 103 | P1 | À faire | Fournir un statut GET distinct de la mutation de rendu. Le polling POST consomme actuellement le quota et peut relancer des travaux. | `render-video.js, downloadRenderedVideo` |
| 104 | P1 | À faire | Compter les vidéos livrées distinctes et la version courante, pas tous les rendus historiques. | `project-state.js:renderCounts` |
| 105 | P0 avant vente | Bloqué : configuration | Configurer le stockage privé durable et vérifier le SDK installé. La production indique persistentMp4RenderConfigured:false. | `health, @vercel/blob, render-video.js` |
| 106 | P0 avant vente | À faire | Construire export de sélection, pack complet, manifeste et téléchargement reprenable ; l’export unitaire ne livre pas encore un pack de 1 000 fichiers. | `routes de rendu` |
| 107 | P0 avant vente | Bloqué : configuration | Configurer Stripe de test ; stripeConfigured:false en production. | `checkout.js` |
| 108 | P0 avant vente | À faire | Créer commande, webhook signé, traitement idempotent, accès acheté et livraison associée au bon projet. | `paiement et schéma` |
| 109 | P0 avant vente | À faire | Vérifier la session Stripe dans le contexte du projet, et prévoir échecs, remboursements et interruptions de redirection. | `payment-status.js` |
| 110 | P1 | À faire | Clarifier le prix de 990 €, paiement unique ou récurrent, nombre de vidéos, texte incrusté, délais et périmètre réellement livré. | `landing, checkout` |
| 111 | P1 | À vérifier | Conserver la preuve des droits publicitaires et de redistribution des clips, ainsi qu’une stratégie de continuité si la source externe disparaît. | `videos.txt` |
| 112 | P2 | À faire | Ajouter FAQ, support et informations commerciales exactes. Ne pas inventer de témoignages ni de résultats. | `landing` |

## Maintenance et validation

| N° | Priorité | État | Amélioration et critère attendu | Référence |
|---|---|---|---|---|
| 113 | P1 | Corrigé dans la branche | Ajouter des tests de catalogue, minimum de mots, absence de troncature et syntaxe frontend. | `tests/reaction-hooks.test.js` |
| 114 | P1 | À faire | Exécuter npm test et npm run check dans un environnement reconnecté ; la déconnexion a empêché ces commandes sur la branche finale. | `validation` |
| 115 | P1 | À faire | Tester la preview sur navigateur, puis comparer miniatures, lecteur et rendu réel avant fusion. | `validation` |
| 116 | P1 | À faire | Ajouter un lockfile produit par une vraie installation et une CI de syntaxe, contrats API et parcours essentiels. | `package.json` |
| 117 | P2 | À faire | Aligner la version Node déclarée (20.x) sur la version Vercel constatée (24.x) après contrôle de compatibilité des binaires. | `package.json, Vercel` |
| 118 | P2 | À faire | Actualiser README : la version d’analyse citée v7 ne correspond plus à _versions.js v8 ; préciser la reprise automatique effective des jobs. | `README.md` |
| 119 | P1 | À faire | Générer le schéma embarqué depuis les migrations ou tester leur égalité complète, pas seulement la présence de quelques colonnes. | `_schema.js, db/migrations` |
| 120 | P1 | À faire | Mesurer p50/p95 du premier aperçu, des hooks validés et des fichiers livrés ; distinguer ces trois événements dans la promesse commerciale. | `observabilité` |
| 121 | P1 | À faire | Tester base vierge, cache entre deux projets, panne fournisseur, doublon de requête, fermeture d’onglet, export et paiement en mode test. | `tests d’intégration` |

## Ordre de livraison

1. Reconnecter l’environnement, exécuter les tests de la branche, ouvrir une preview et vérifier la grille et le lecteur en mobile/bureau.
2. Contrôler le catalogue éditorial : réduire les variations trop similaires et vérifier le sens de chaque réaction. Le chevauchement du visage est autorisé s’il reste esthétiquement pertinent.
3. Rétablir le fournisseur puis terminer les analyses permanentes. Garder une trace explicite des clips non validés.
4. Unifier le contrat aperçu/export et valider des MP4 réels, y compris avec texte long et caractères spéciaux.
5. Fiabiliser files, idempotence, isolation historique et quotas ; réaliser le benchmark de 1 000 livrables.
6. Terminer stockage, commande, paiement de test et pack téléchargeable avant ouverture commerciale.

## Réception des hooks et du lecteur

- Chaque miniature et vidéo ouverte présente un texte complet, sans point de suspension ajouté ni ligne coupée.
- Chaque hook de landing promeut videoma et sa promesse demandée ; aucun hook hors sujet sur le marketing en général.
- Chaque nouveau hook comporte au moins six mots ; les anciens hooks clients trop courts nécessitent une régénération.
- Le choix de police, taille et contraste reste lisible ; le texte peut recouvrir le visage sur certaines compositions.
- Molette, geste vertical, boutons et clavier passent au bon index sans fermer le lecteur ni lire deux vidéos principales en parallèle.
- Fermer le lecteur restaure focus et position de scroll.
- La correspondance aux réactions ne sera déclarée validée qu’après visionnage ou analyse fiable de chaque vidéo.
