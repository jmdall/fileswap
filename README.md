# 🔒 Secure File Exchange

Système d'échange sécurisé de fichiers avec double validation.

## 🚀 Démarrage rapide

### Prérequis
- Docker Desktop
- Node.js 18+
- PowerShell (Windows) ou Bash (Linux/Mac)

### Installation (Windows PowerShell)

```powershell
# 1. Lancer le script de setup
.\setup.ps1

# 2. Démarrer le backend
cd backend
npm run dev
```

### Installation manuelle

```bash
# 1. Lancer les services Docker
docker-compose up -d

# 2. Attendre que les services démarrent (environ 15 secondes)
sleep 15

# 3. Configurer MinIO
docker exec secure-file-exchange-minio-1 sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb -p local/file-exchange"

# 4. Installer les dépendances du backend
cd backend
npm install

# 5. Lancer le backend
npm run dev
```

## 📋 URLs importantes

- **API Backend**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432 (exchange_user/exchange_pass)
- **Redis**: localhost:6379

## 🧪 Tester l'API

### Créer une session d'échange

```powershell
# PowerShell
$response = Invoke-RestMethod -Uri http://localhost:3000/api/sessions -Method Post -ContentType "application/json"
$response | ConvertTo-Json -Depth 5
```

```bash
# Bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" | jq
```

### Flow complet

1. **Créer une session** : `POST /api/sessions`
2. **Récupérer les deux tokens** depuis la réponse
3. **Joindre la session** avec chaque token : `POST /api/sessions/{sessionId}/join`
4. **Obtenir l'URL d'upload** : `POST /api/uploads/presign`
5. **Uploader le fichier** vers l'URL S3 présignée
6. **Confirmer l'upload** : `POST /api/uploads/complete`
7. **Vérifier le statut** : `GET /api/sessions/{sessionId}/status`
8. **Accepter l'échange** : `POST /api/sessions/{sessionId}/accept`
9. **Télécharger les fichiers** via les URLs fournies

## 🛠️ Structure du projet

```
secure-file-exchange/
├── backend/
│   ├── src/
│   │   ├── server.js           # Point d'entrée
│   │   ├── config.js           # Configuration
│   │   ├── db/
│   │   │   ├── index.js        # Connexion DB
│   │   │   └── schema.sql      # Schéma PostgreSQL
│   │   ├── routes/
│   │   │   ├── sessions.js     # API sessions
│   │   │   └── uploads.js      # API uploads
│   │   ├── services/
│   │   │   ├── redis.js        # Service Redis
│   │   │   ├── preview.js      # Génération previews
│   │   │   └── scanner.js      # Scan antivirus
│   │   └── ws/
│   │       └── handler.js      # WebSocket
│   ├── package.json
│   └── .env
├── docker-compose.yml
├── setup.ps1
└── README.md
```

## 🔧 Commandes utiles

```powershell
# Voir les logs des services
docker-compose logs -f

# Redémarrer les services
docker-compose restart

# Arrêter tout
docker-compose down

# Nettoyer tout (avec les volumes)
docker-compose down -v

# Accéder à PostgreSQL
docker exec -it secure-file-exchange-postgres-1 psql -U exchange_user -d file_exchange

# Accéder à Redis
docker exec -it secure-file-exchange-redis-1 redis-cli

# Voir le contenu de MinIO
docker exec secure-file-exchange-minio-1 mc ls local/file-exchange
```

## 🐛 Troubleshooting

### Le backend ne démarre pas
- Vérifier que Docker est lancé
- Vérifier que les ports ne sont pas utilisés : 3000, 5432, 6379, 9000, 9001
- Vérifier les logs : `docker-compose logs`

### Erreur de connexion à la base de données
- Attendre que PostgreSQL soit complètement démarré (15-20 secondes)
- Vérifier : `docker exec secure-file-exchange-postgres-1 pg_isready`

### MinIO ne fonctionne pas
- Accéder à http://localhost:9001
- Login: minioadmin / minioadmin
- Vérifier que le bucket `file-exchange` existe

## 📝 TODO

- [ ] Interface frontend Angular
- [ ] Tests unitaires et d'intégration
- [ ] Documentation API complète
- [ ] Déploiement production

## 📄 Licence

MIT

## 🤝 Support

Pour toute question, créer une issue sur GitHub.
