# ── ARGOCD ─────────────────────────────────────────────────

resource "helm_release" "argocd" {
  depends_on = [kubernetes_namespace.argocd]

  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  namespace  = kubernetes_namespace.argocd.metadata[0].name
  version    = "7.4.0"

  # On garde l'exposition en NodePort pour l'accès externe sur EC2
  set {
    name  = "server.service.type"
    value = "NodePort"
  }

  set {
    name  = "server.service.nodePortHttp"
    value = "30080"
  }

  set {
    name  = "server.service.nodePortHttps"
    value = "30443"
  }

  # Indispensable si tu mets un Ingress (Traefik/Nginx) devant plus tard
  set {
    name  = "server.insecure"
    value = "true"
  }

  # Les ressources (limits/requests) sont maintenant gérées par les défauts du Chart
  
  wait    = true
  timeout = 600
}

# ── ARGOCD APPLICATION ─────────────────────────────────────

resource "kubectl_manifest" "argocd_app" {
  depends_on = [helm_release.argocd]

  yaml_body = <<-YAML
    apiVersion: argoproj.io/v1alpha1
    kind: Application
    metadata:
      name: ${var.project_name}
      namespace: argocd
      finalizers:
        - resources-finalizer.argocd.argoproj.io
    spec:
      project: default
      source:
        repoURL: ${var.github_repo_url}
        targetRevision: main
        path: k8s
      destination:
        server: https://kubernetes.default.svc
        namespace: ${var.project_name}
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
  YAML
}