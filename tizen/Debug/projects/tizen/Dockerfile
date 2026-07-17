FROM nginx:alpine

# Add correct MIME type for Tizen .wgt packages
RUN sed -i 's|types {|types {\n    application/widget wgt;|' /etc/nginx/mime.types

# Copy SSSP config and the compiled .wgt package to the Nginx web root
COPY sssp_config.xml /usr/share/nginx/html/sssp_config.xml
COPY Debug/tizen.wgt /usr/share/nginx/html/tizen.wgt

EXPOSE 80
