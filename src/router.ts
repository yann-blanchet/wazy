import type { RouteRecordRaw } from 'vue-router'

import HomePage from './views/HomePage.vue'
import LoginPage from './views/LoginPage.vue'
import DashboardPage from './views/DashboardPage.vue'
import SettingsPage from './views/SettingsPage.vue'
import PublicRestaurantPage from './views/PublicRestaurantPage.vue'
import HistoryPage from './views/HistoryPage.vue'
import EnhancePage from './views/EnhancePage.vue'
import OnboardingPage from './views/OnboardingPage.vue'
import InfosPage from './views/InfosPage.vue'
import CarteRestoPage from './views/CarteRestoPage.vue'
import GaleriePage from './views/GaleriePage.vue'
import LienPublicPage from './views/LienPublicPage.vue'
import EquipePage from './views/EquipePage.vue'
import StatsPage from './views/StatsPage.vue'
import LogoutPage from './views/LogoutPage.vue'
import RecupAdminPage from './views/RecupAdminPage.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'login', component: LoginPage },
  { path: '/login', redirect: '/' },
  { path: '/dashboard', name: 'dashboard', component: DashboardPage },
  { path: '/recup-admin', name: 'recup-admin', component: RecupAdminPage },
  { path: '/infos', name: 'infos', component: InfosPage },
  { path: '/carte', name: 'carte', component: CarteRestoPage },
  { path: '/galerie', name: 'galerie', component: GaleriePage },
  { path: '/lien-public', name: 'lien-public', component: LienPublicPage },
  { path: '/equipe', name: 'equipe', component: EquipePage },
  { path: '/stats', name: 'stats', component: StatsPage },
  { path: '/logout', name: 'logout', component: LogoutPage },
  { path: '/enhance', name: 'enhance', component: EnhancePage },
  { path: '/history', name: 'history', component: HistoryPage },
  { path: '/onboarding', name: 'onboarding', component: OnboardingPage },
  { path: '/settings', name: 'settings', component: SettingsPage },
  { path: '/r/:id', name: 'public', component: PublicRestaurantPage }
]
