import type { RouteRecordRaw } from 'vue-router'

import LoginPage from './views/LoginPage.vue'
import DashboardPage from './views/DashboardPage.vue'
import PublicRestaurantPage from './views/PublicRestaurantPage.vue'
import HistoryPage from './views/HistoryPage.vue'
import EnhancePage from './views/EnhancePage.vue'
import OnboardingPage from './views/OnboardingPage.vue'
import InfosPage from './views/InfosPage.vue'
import CarteRestoPage from './views/CarteRestoPage.vue'
import GaleriePage from './views/GaleriePage.vue'
import LienPublicPage from './views/LienPublicPage.vue'
import StatsPage from './views/StatsPage.vue'
import AuthPage from './views/AuthPage.vue'
import AccessCodesPage from './views/AccessCodesPage.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'login', component: LoginPage },
  { path: '/auth', name: 'auth', component: AuthPage },
  { path: '/login', redirect: '/' },
  { path: '/dashboard', name: 'dashboard', component: DashboardPage },
  { path: '/codes-acces', name: 'codes-acces', component: AccessCodesPage },
  { path: '/infos', name: 'infos', component: InfosPage },
  { path: '/carte', name: 'carte', component: CarteRestoPage },
  { path: '/galerie', name: 'galerie', component: GaleriePage },
  { path: '/lien-public', name: 'lien-public', component: LienPublicPage },
  { path: '/stats', name: 'stats', component: StatsPage },
  { path: '/enhance', name: 'enhance', component: EnhancePage },
  { path: '/history', name: 'history', component: HistoryPage },
  { path: '/onboarding', name: 'onboarding', component: OnboardingPage },
  { path: '/r/:id', name: 'public', component: PublicRestaurantPage }
]
