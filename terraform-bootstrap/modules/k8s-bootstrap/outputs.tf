output "argocd_namespace" {
  value = kubernetes_namespace.argocd.metadata[0].name
}

output "app_namespace" {
  value = kubernetes_namespace.app.metadata[0].name
}
