# Secure File Exchange - Scripts

Ce dossier contient tous les scripts utilitaires pour gérer l'application Secure File Exchange.

## 📋 Scripts disponibles

### setup.ps1 / setup.sh
Script principal d'installation et de configuration de l'environnement.

**Options :**
- `--skip-dependencies` : Ne pas installer les dépendances npm
- `--reset-database` : Réinitialiser complètement la base de données
- `--start-services` : Démarrer automatiquement backend et frontend

**Exemples :**
```powershell
# Installation standard
.\scripts\setup.ps1

# Installation avec reset de DB et démarrage auto
.\scripts\setup.ps1 -ResetDatabase -StartServices

# Linux/Mac
./scripts/setup.sh --reset-database --start-services
```

### reset-db.ps1
Réinitialise complètement la base de données (supprime toutes les données).

**Options :**
- `-Confirm` : Saute la demande de confirmation

**Exemple :**
```powershell
.\scripts\reset-db.ps1
.\scripts\reset-db.ps1 -Confirm  # Sans demande de confirmation
```

## 🚀 Démarrage rapide

### Windows
```powershell
# 1. Setup initial
.\scripts\setup.ps1

# 2. Démarrer les services Docker uniquement
docker-compose up -d

# 3. Démarrer backend et frontend (dans des terminaux séparés)
cd backend && npm run dev
cd frontend && ng serve
```

### Linux/Mac
```bash
# 1. Setup initial
chmod +x ./scripts/setup.sh
./scripts/setup.sh

# 2. Démarrer les services Docker uniquement
docker-compose up -d

# 3. Démarrer backend et frontend
cd backend && npm run dev
cd frontend && ng serve
```

## 🐳 Docker Compose

Le fichier `docker-compose.yml` a été simplifié avec des profils :

```bash
# Services de base uniquement (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Avec les conteneurs de développement (backend + frontend)
docker-compose --profile dev up -d

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (reset complet)
docker-compose down -v
```

## 📁 Structure simplifiée

```
secure-file-exchange/
├── docker-compose.yml       # Configuration Docker unifiée
├── scripts/                 # Tous les scripts utilitaires
│   ├── setup.ps1           # Setup Windows
│   ├── setup.sh            # Setup Linux/Mac
│   ├── reset-db.ps1        # Reset base de données
│   └── README.md           # Cette documentation
├── backend/
│   ├── src/                # Code source backend
│   ├── package.json
│   └── Dockerfile
└── frontend/
    ├── src/                # Code source frontend
    ├── package.json
    └── Dockerfile
```

## 🔧 Variables d'environnement

Les services utilisent les configurations suivantes :

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 5432 | exchange_user / exchange_pass |
| Redis | 6379 | - |
| MinIO | 9000 (API) / 9001 (Console) | minioadmin / minioadmin |
| Backend | 3000 | - |
| Frontend | 4200 | - |

## 💡 Conseils

1. **Premier démarrage** : Utilisez `setup.ps1` ou `setup.sh` qui gère tout automatiquement
2. **Problèmes de DB** : Utilisez `reset-db.ps1` pour repartir sur une base propre
3. **Développement** : Les services Docker de base suffisent, lancez backend/frontend localement
4. **Production** : Utilisez le profil Docker `dev` pour tout conteneuriser

## 🆘 Dépannage

- **Docker ne démarre pas** : Vérifiez que Docker Desktop est lancé
- **Port déjà utilisé** : Modifiez les ports dans `docker-compose.yml`
- **Base de données corrompue** : Utilisez `reset-db.ps1`
- **MinIO ne se configure pas** : Relancez `setup.ps1` ou configurez manuellement via la console MinIO