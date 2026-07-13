FROM nginx:alpine

# Copy SSSP config and the compiled .wgt package to the Nginx web root
COPY sssp_config.xml /usr/share/nginx/html/sssp_config.xml
COPY Debug/tizen.wgt /usr/share/nginx/html/tizen.wgt

EXPOSE 80
