import type { RouteRecordRaw } from 'vue-router'

import HomePage from './views/HomePage.vue'
import LoginPage from './views/LoginPage.vue'
import DashboardPage from './views/DashboardPage.vue'
import SettingsPage from './views/SettingsPage.vue'
import PublicRestaurantPage from './views/PublicRestaurantPage.vue'
import HistoryPage from './views/HistoryPage.vue'
import EnhancePage from './views/EnhancePage.vue'
import OnboardingPage from './views/OnboardingPage.vue'
import RestaurantPage from './views/RestaurantPage.vue'
import SharePage from './views/SharePage.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/login', name: 'login', component: LoginPage },
  { path: '/dashboard', name: 'dashboard', component: DashboardPage },
  { path: '/restaurant', name: 'restaurant', component: RestaurantPage },
  { path: '/share', name: 'share', component: SharePage },
  { path: '/enhance', name: 'enhance', component: EnhancePage },
  { path: '/history', name: 'history', component: HistoryPage },
  { path: '/onboarding', name: 'onboarding', component: OnboardingPage },
  { path: '/settings', name: 'settings', component: SettingsPage },
  { path: '/r/:id', name: 'public', component: PublicRestaurantPage }
]
