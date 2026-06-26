# ---- build stage (Vite) ----
FROM node:20-alpine AS build
WORKDIR /app

# Vite inlines VITE_* vars at build time, so they must be present during build.
ARG VITE_API_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SITE_URL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SITE_URL=$VITE_SITE_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage (nginx) ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
