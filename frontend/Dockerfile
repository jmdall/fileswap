FROM node:18-alpine

WORKDIR /app

# Installer Angular CLI globalement
RUN npm install -g @angular/cli@15

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 4200

# Commande de démarrage
CMD ["ng", "serve", "--host", "0.0.0.0", "--proxy-config", "proxy.conf.json"]
