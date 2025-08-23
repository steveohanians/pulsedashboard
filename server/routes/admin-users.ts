import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../db';
import { users, clients } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/users
 * Get all users for admin view-as feature
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get all users with their client information and activity data
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        clientId: users.clientId,
        role: users.role,
        status: users.status,
        lastLogin: users.lastLogin,
        loginCount: users.loginCount,
        pageViews: users.pageViews,
        aiInsightsCount: users.aiInsightsCount,
        brandSovCount: users.brandSovCount,
        clientName: clients.name,
      })
      .from(users)
      .leftJoin(clients, eq(users.clientId, clients.id))
      .orderBy(users.name);

    // Format the response
    const formattedUsers = allUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      clientId: user.clientId,
      clientName: user.clientName || 'No Client',
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      pageViews: user.pageViews,
      aiInsightsCount: user.aiInsightsCount,
      brandSovCount: user.brandSovCount,
      label: `${user.name} (${user.clientName || 'No Client'})`
    }));

    res.json({ 
      success: true,
      users: formattedUsers 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch users' 
    });
  }
});

/**
 * GET /api/admin/view-as/:userId
 * Get dashboard data for a specific user (admin view-as)
 */
router.get('/view-as/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get the target user's client ID
    const targetUser = await db
      .select({
        clientId: users.clientId,
        name: users.name
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser || targetUser.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Return the client ID for the dashboard to use
    res.json({
      success: true,
      clientId: targetUser[0].clientId,
      userName: targetUser[0].name
    });
  } catch (error) {
    console.error('Error in view-as:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get user data' 
    });
  }
});

export default router;