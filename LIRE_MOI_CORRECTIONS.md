# PogoWeather — corrections et mise en ligne

Projet corrigé et complété le 6 novembre 2026. Les fichiers du projet sont à la racine de cette archive : `server.js`, `package.json`, `api`, `data` et `public`. L’archive d’origine reste inchangée.

## 1. Essayer le site sur ton ordinateur

1. Décompresse le ZIP dans un nouveau dossier et ouvre ce dossier avec VS Code.
2. Ouvre le terminal de VS Code, à la racine du dossier.
3. Exécute `npm install`, puis `npm run dev`.
4. Va sur http://localhost:3000. Teste une recherche Pokémon, les prévisions, les raids et le menu sur téléphone ou en réduisant la fenêtre.

Pour arrêter le serveur, appuie sur Ctrl+C dans le terminal. Le site utilise Node.js 18 ou une version plus récente. Il doit pouvoir accéder aux fournisseurs externes pour afficher des données réelles.

## 2. Mettre les changements en ligne

Le ZIP ne modifie pas automatiquement ton site en ligne. Sauvegarde ton projet déployé, puis publie ces fichiers avec la méthode habituelle de ton hébergeur. Conserve tes éventuelles variables d’environnement, secrets, fichiers de configuration spécifiques et réglages qui ne figuraient pas dans le ZIP d’origine. La méthode exacte dépend de ton hébergement.

Après déploiement, vérifie :

- https://pogoweather.com/ et une recherche réelle ;
- https://pogoweather.com/fr/methode et https://pogoweather.com/methodology ;
- le menu sur mobile, les prévisions et la page des raids ;
- https://pogoweather.com/robots.txt et https://pogoweather.com/sitemap.xml ;
- https://pogoweather.com/ads.txt : le texte doit être visible et l’identifiant doit correspondre au compte AdSense ;
- que l’adresse contact@pogoweather.com reçoit effectivement les messages : le projet la mentionne déjà, mais son fonctionnement n’a pas été vérifié.

## 3. Ce qui a été changé

- Des guides d’utilisation en français et en anglais expliquent les modes, les villes personnalisées, les sources et les limites, sans publier les règles de calcul ni les seuils.
- Sur l’accueil, les résultats précisent que les estimations ne sont pas des probabilités validées.
- Les guides de Rayquaza, Necrozma, Kyogre, Groudon et Darkrai ont été réécrits en français et en anglais avec des conseils distincts et des liens vers des sources officielles. Les pages de prévision, de comparaison météo et de raids ont aussi été précisées.
- La page de raccourcis GO Fest précise qu’elle n’affiche pas elle-même des résultats météo en direct.
- L’accueil présente un mode d’emploi et regroupe les guides par sujet. Le menu est accessible sur petit écran. Le contact anglais, dont la fin du HTML était mal formée, a été réparé.
- Une panne météo pour une ville n’entraîne plus automatiquement l’échec de toute la recherche. Les données indisponibles sont signalées ; la carte ne les présente pas comme un résultat négatif.
- Le mode 24 h affiche désormais tous les lieux renvoyés par le serveur, dans la limite existante de 25. La carte des anciens résultats est effacée quand une nouvelle recherche démarre.
- Le formulaire des villes personnalisées refuse les coordonnées vides et indique la limite de 20 villes. Les éléments principaux de l’outil ont été améliorés en français et en anglais.
- Les PC de raid ne sont plus calculés par une approximation présentée comme exacte. Les champs qui ne sont pas fournis par la source sont affichés N/A.
- Les 40 URL du sitemap d’origine ont été conservées. Deux nouvelles pages ont été ajoutées. Une adresse inexistante renvoie désormais une vraie erreur 404.
- Les données Open-Meteo sont attribuées près des résultats et les sources sont liées dans la page de méthode.
- `public/ads.txt` a été ajouté à partir de l’identifiant déjà présent dans le projet ; compare-le avec ton compte avant publication.

## 4. Protéger les réglages du modèle

Le serveur renvoie les estimations et les informations météo utiles aux joueurs, mais plus les raisons techniques contenant des seuils, les statistiques internes des fenêtres ou le détail des votes. Le modèle continue de tourner côté serveur. Il reste possible d’inférer certains comportements en interrogeant un service public : aucune protection absolue n’est garantie.

**Ce ZIP contient le code complet du serveur et ses réglages.** Ne place pas ce ZIP dans le dossier public de ton site et ne le partage pas publiquement. Si tu déploies avec GitHub, utilise un dépôt privé ou vérifie que le code du serveur n’est pas accessible publiquement. Ne publie jamais non plus de clés API ou de secrets dans le dépôt.

## 5. Points à vérifier avant de diffuser des publicités

- **Open-Meteo :** le code utilise actuellement les points d’accès gratuits. Les conditions du fournisseur classent notamment les sites affichant des annonces parmi les usages commerciaux. Consulte https://open-meteo.com/en/terms et https://open-meteo.com/en/pricing, puis choisis une solution autorisée avant la diffusion des annonces. Si tu prends une offre commerciale, le code devra être adapté à l’API et à la clé fournie ; confirme aussi l’accès à l’API des prévisions antérieures. Aucune clé n’a été ajoutée.
- **Consentement :** pour les annonces personnalisées dans l’EEE, au Royaume-Uni et en Suisse, Google demande une plateforme de gestion du consentement certifiée, intégrée au TCF : https://support.google.com/adsense/answer/13554116. Vérifie dans AdSense ce qui est déjà configuré. Une politique de cookies seule ne prouve pas que le consentement est configuré.
- **ads.txt :** le fichier `public/ads.txt` a été ajouté avec la référence `pub-3838256821832142`, relevée dans le script AdSense déjà présent sur l’accueil. Avant la mise en ligne, compare cette référence avec l’extrait exact fourni dans ton compte AdSense → Sites → pogoweather.com. Si elle ne correspond pas, remplace la ligne par celle fournie par AdSense. Si ton hébergement possède déjà un fichier ads.txt avec d’autres vendeurs, conserve leurs lignes et ajoute ou corrige seulement la ligne Google. Après publication, vérifie que https://pogoweather.com/ads.txt affiche le texte ; dans AdSense, utilise « Rechercher des mises à jour ». Le statut peut mettre plusieurs jours, voire davantage, à être actualisé. L’état ads.txt et le refus pour contenu à faible valeur sont deux informations distinctes.
- Relis les pages et complète-les avec tes propres observations vérifiables, les retours des joueurs et des informations tenues à jour. Aucun nombre précis d’articles ne garantit une validation.

## 6. Demander le réexamen

Une fois la version modifiée publiée et vérifiée, ouvre AdSense → Sites → pogoweather.com, confirme que les problèmes ont été corrigés, puis demande le réexamen. Google est seul à prendre la décision : les changements améliorent le site mais ne garantissent pas l’acceptation.

Google indique que l’examen prend généralement quelques jours et peut parfois durer 2 à 4 semaines : https://support.google.com/adsense/answer/12176698.

## Vérifications effectuées sur le projet

Les 42 URL du sitemap, dont les 40 d’origine, ont été testées localement avec leurs balises canoniques et leurs liens internes. Les recherches, pannes partielles, réponses publiques de l’API, villes personnalisées et affichage des 25 résultats ont été testés avec des données simulées. Les PC de raid ont également été testés avec des données simulées. Ces tests ne garantissent pas la disponibilité réelle des API externes ni l’affichage visuel sur tous les appareils.
