FROM golang:1.22-alpine AS build
WORKDIR /src
COPY main.go ./
RUN go build -o /out/service .
FROM alpine:3.20
COPY --from=build /out/service /service
EXPOSE 8080
CMD ["/service"]
