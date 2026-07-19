FROM nginx:alpine

# Add correct MIME type for Tizen .wgt packages
RUN sed -i 's|types {|types {\n    application/widget wgt;|' /etc/nginx/mime.types

COPY sssp_config.xml /usr/share/nginx/html/sssp_config.xml
COPY Debug/tizen.wgt /usr/share/nginx/html/tizen.wgt

# Copy web files to allow running as a Web App page in standard browsers
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js
COPY index.css /usr/share/nginx/html/index.css

EXPOSE 80
