<template>
  <div class="route-loading-shell" aria-live="polite" aria-busy="true">
    <div class="route-loading-header">
      <span class="route-loading-nav" />
      <div class="route-loading-title-group">
        <span class="route-loading-title" />
        <span class="route-loading-subtitle" />
      </div>
      <span class="route-loading-nav route-loading-nav--ghost" />
    </div>

    <div class="route-loading-body">
      <div class="route-loading-card route-loading-card--hero">
        <span class="route-loading-line route-loading-line--strong" />
        <span class="route-loading-line route-loading-line--mid" />
        <span class="route-loading-line route-loading-line--short" />
      </div>

      <div class="route-loading-card">
        <span class="route-loading-line route-loading-line--mid" />
        <span class="route-loading-line" />
        <span class="route-loading-line route-loading-line--short" />
      </div>

      <div class="route-loading-card route-loading-card--compact">
        <span class="route-loading-pill" />
        <span class="route-loading-pill route-loading-pill--wide" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.route-loading-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.route-loading-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.route-loading-nav,
.route-loading-nav--ghost {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--route-loading-surface);
  flex-shrink: 0;
}

.route-loading-nav--ghost {
  opacity: 0.55;
}

.route-loading-title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.route-loading-title,
.route-loading-subtitle,
.route-loading-line,
.route-loading-pill {
  position: relative;
  overflow: hidden;
  background: var(--route-loading-surface);
}

.route-loading-title::after,
.route-loading-subtitle::after,
.route-loading-line::after,
.route-loading-pill::after,
.route-loading-nav::after,
.route-loading-nav--ghost::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, var(--route-loading-shimmer), transparent);
  animation: route-loading-shimmer 1.2s ease-in-out infinite;
}

.route-loading-title {
  width: 120px;
  height: 16px;
  border-radius: 999px;
}

.route-loading-subtitle {
  width: 84px;
  height: 10px;
  border-radius: 999px;
}

.route-loading-body {
  flex: 1;
  overflow: hidden;
  padding: 24px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.route-loading-card {
  background: var(--card);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 8px 24px var(--shadow-color);
}

.route-loading-card--hero {
  padding: 22px 18px;
  background: linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end));
}

.route-loading-card--hero .route-loading-line {
  background: rgba(255, 255, 255, 0.24);
}

.route-loading-card--compact {
  flex-direction: row;
  align-items: center;
}

.route-loading-line {
  width: 100%;
  height: 12px;
  border-radius: 999px;
}

.route-loading-line--strong {
  width: 56%;
  height: 18px;
}

.route-loading-line--mid {
  width: 72%;
}

.route-loading-line--short {
  width: 44%;
}

.route-loading-pill {
  width: 76px;
  height: 32px;
  border-radius: 12px;
}

.route-loading-pill--wide {
  width: 116px;
}

@keyframes route-loading-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-loading-title::after,
  .route-loading-subtitle::after,
  .route-loading-line::after,
  .route-loading-pill::after,
  .route-loading-nav::after,
  .route-loading-nav--ghost::after {
    animation-duration: 2.4s;
  }
}
</style>
