# GestiCom Pro

GestiCom Pro est une solution moderne de gestion commerciale (ERP) conçue pour la gestion des ventes, des achats, des stocks et de la comptabilité.

## 🚀 Technologies Utilisées

- **Framework** : [Next.js](https://nextjs.org/) (React 19)
- **Base de données** : [SQLite](https://sqlite.org/) avec [Prisma ORM](https://www.prisma.io/)
- **Stylisation** : [Tailwind CSS 4](https://tailwindcss.com/)
- **Gestion d'état** : [Zustand](https://github.com/pmndrs/zustand)
- **Validation** : [Zod](https://zod.dev/) & React Hook Form
- **Rapports** : Export Excel (xlsx) et PDF (jsPDF)

## 🛠️ Installation

Suivez ces étapes pour installer le projet sur une nouvelle machine :

1. **Cloner le projet**
   ```bash
   git clone https://github.com/Pacousstar/gesticom-pro-master.git
   cd gesticom-pro-master
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration de l'environnement**
   Créez un fichier `.env` à la racine du projet et ajoutez les variables nécessaires (voir `.env.example` si disponible ou copier le `.env` de production).
   ```env
   DATABASE_URL="file:./gesticom.db"
   ```

4. **Initialiser la base de données**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

## 📂 Gestion de la Base de Données (SQLite)

Comme nous utilisons SQLite, la base de données est stockée localement dans le dossier `prisma/`. 

> [!IMPORTANT]
> **Le fichier de base de données (`gesticom.db`) est ignoré par Git pour des raisons de sécurité.**
> Pour transférer vos données d'un PC à un autre, vous devez copier manuellement le fichier `prisma/gesticom.db`.

### Commandes utiles
- `npm run db:studio` : Ouvre une interface visuelle pour explorer la base de données.
- `npm run db:backup` : Effectue une sauvegarde de la base de données.
- `npm run db:reset-admin` : Réinitialise le mot de passe administrateur.

## 🔄 Flux de Travail Git

Si vous travaillez sur plusieurs ordinateurs, suivez ce cycle :

1. **Avant de commencer** : Récupérez les dernières modifications de code.
   ```bash
   git pull origin master
   ```
2. **Après avoir travaillé** : Enregistrez et envoyez vos modifications.
   ```bash
   git add .
   git commit -m "Description de vos changements"
   git push origin master
   ```

## 📜 Licence
Ce projet est privé et destiné à l'usage exclusif de GSN EXPERTISES GROUP.
