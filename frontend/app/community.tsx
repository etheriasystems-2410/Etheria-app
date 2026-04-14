import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paywall } from '../components/Paywall';
import HeaderBanner from '../components/HeaderBanner';
import { Image } from 'expo-image';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_name: string;
  author_id: string;
  is_admin?: boolean;
  category: string;
  created_at: string;
  comment_count: number;
  likes: number;
}

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_id: string;
  is_admin?: boolean;
  created_at: string;
  likes: number;
}

interface ChatMessage {
  id: string;
  message: string;
  author_name: string;
  author_id: string;
  is_admin?: boolean;
  created_at: string;
}

type ViewMode = 'categories' | 'posts' | 'post-detail' | 'chat';

export default function Community() {
  const { user, isPremium, authToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Guidelines agreement state
  const [hasAgreedToGuidelines, setHasAgreedToGuidelines] = useState<boolean | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [agreeingToGuidelines, setAgreeingToGuidelines] = useState(false);
  
  // Form states
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Flag state
  const [flagging, setFlagging] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState<string | null>(null);
  
  const chatScrollRef = useRef<FlatList>(null);
  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  // Check guidelines agreement on mount
  useEffect(() => {
    checkGuidelinesAgreement();
  }, [authToken]);

  // Fetch categories on mount (only if agreed to guidelines)
  useEffect(() => {
    if (hasAgreedToGuidelines === true) {
      fetchCategories();
    } else if (hasAgreedToGuidelines === false) {
      setShowGuidelines(true);
    }
  }, [hasAgreedToGuidelines]);

  // Poll for new chat messages
  useEffect(() => {
    if (viewMode === 'chat' && selectedCategory) {
      chatPollRef.current = setInterval(() => {
        fetchChatMessages(selectedCategory.id, true);
      }, 5000);
    }
    
    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
      }
    };
  }, [viewMode, selectedCategory]);

  const checkGuidelinesAgreement = async () => {
    if (!authToken) {
      setHasAgreedToGuidelines(false);
      return;
    }
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/guidelines-agreement?token=${authToken}`
      );
      const data = await response.json();
      setHasAgreedToGuidelines(data.agreed === true);
    } catch (err) {
      console.error('Error checking guidelines:', err);
      setHasAgreedToGuidelines(false);
    }
  };

  const handleAgreeToGuidelines = async () => {
    if (!authToken) return;
    
    setAgreeingToGuidelines(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/guidelines-agreement?token=${authToken}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        setHasAgreedToGuidelines(true);
        setShowGuidelines(false);
        fetchCategories();
      } else {
        setError('Failed to record agreement. Please try again.');
      }
    } catch (err) {
      console.error('Error agreeing to guidelines:', err);
      setError('Failed to record agreement. Please try again.');
    } finally {
      setAgreeingToGuidelines(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/community/categories`);
      const data = await response.json();
      setCategories(data.categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchPosts = async (categoryId: string) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/posts/${categoryId}?token=${authToken}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch posts');
      }
      
      setPosts(data.posts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchComments = async (postId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/posts/${postId}/comments?token=${authToken}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (room: string, silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/chat/${room}?token=${authToken}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setChatMessages(data.messages);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCategorySelect = (category: Category) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    
    setSelectedCategory(category);
    setViewMode('posts');
    fetchPosts(category.id);
  };

  const handlePostSelect = (post: Post) => {
    setSelectedPost(post);
    setViewMode('post-detail');
    fetchComments(post.id);
  };

  const handleEnterChat = (category: Category) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    
    setSelectedCategory(category);
    setViewMode('chat');
    fetchChatMessages(category.id);
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      setError('Please fill in both title and content');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/community/posts?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory?.id,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create post');
      }
      
      // Reset form and refresh
      setNewPostTitle('');
      setNewPostContent('');
      setShowNewPostForm(false);
      fetchPosts(selectedCategory!.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/posts/${selectedPost?.id}/comments?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to add comment');
      }
      
      setNewComment('');
      fetchComments(selectedPost!.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/chat/${selectedCategory?.id}?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: selectedCategory?.id, message: newMessage.trim() }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send message');
      }
      
      setNewMessage('');
      fetchChatMessages(selectedCategory!.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/community/posts/${postId}/like?token=${authToken}`, {
        method: 'POST',
      });
      fetchPosts(selectedCategory!.id);
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const handleFlagContent = async (contentType: 'post' | 'comment' | 'chat', contentId: string) => {
    if (flagging) return;
    
    setFlagging(true);
    setFlagSuccess(null);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/flag/${contentType}/${contentId}?token=${authToken}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to flag content');
      }
      
      setFlagSuccess(data.message);
      setTimeout(() => setFlagSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setFlagging(false);
    }
  };

  const handleBack = () => {
    if (viewMode === 'post-detail') {
      setViewMode('posts');
      setSelectedPost(null);
      setComments([]);
    } else if (viewMode === 'posts' || viewMode === 'chat') {
      setViewMode('categories');
      setSelectedCategory(null);
      setPosts([]);
      setChatMessages([]);
    } else {
      router.back();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  // Render Categories View
  const renderCategories = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        {/* Hero Image */}
        <View style={styles.heroImageContainer}>
          <Image
            source={require('../assets/images/community-hero.png')}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={styles.heroOverlay} />
        </View>
        
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSubtitle}>Connect with fellow seekers</Text>
        
        {!isPremium && (
          <View style={styles.premiumBanner}>
            <Ionicons name="diamond" size={20} color="#ffd700" />
            <Text style={styles.premiumBannerText}>Premium feature - Upgrade to join</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.sectionTitle}>Discussion Boards</Text>
      {categories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[styles.categoryCard, { borderLeftColor: category.color }]}
          onPress={() => handleCategorySelect(category)}
        >
          <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
            <Ionicons name={category.icon as any} size={28} color={category.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9f7aea" />
        </TouchableOpacity>
      ))}
      
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Live Chat Rooms</Text>
      {categories.map((category) => (
        <TouchableOpacity
          key={`chat-${category.id}`}
          style={[styles.chatRoomCard, { borderColor: category.color }]}
          onPress={() => handleEnterChat(category)}
        >
          <View style={[styles.chatRoomIcon, { backgroundColor: category.color }]}>
            <Ionicons name="chatbubbles" size={20} color="#fff" />
          </View>
          <Text style={styles.chatRoomName}>{category.name} Chat</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </TouchableOpacity>
      ))}
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // Render Posts List
  const renderPosts = () => (
    <View style={styles.content}>
      <View style={styles.postsHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: selectedCategory?.color + '20' }]}>
          <Ionicons name={selectedCategory?.icon as any} size={20} color={selectedCategory?.color} />
          <Text style={[styles.categoryBadgeText, { color: selectedCategory?.color }]}>
            {selectedCategory?.name}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.newPostButton}
          onPress={() => setShowNewPostForm(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {showNewPostForm && (
        <View style={styles.newPostForm}>
          <Text style={styles.formTitle}>Create New Post</Text>
          <TextInput
            style={styles.input}
            placeholder="Post title..."
            placeholderTextColor="#6b7280"
            value={newPostTitle}
            onChangeText={setNewPostTitle}
            maxLength={100}
          />
          <TextInput
            style={[styles.input, styles.contentInput]}
            placeholder="Share your thoughts..."
            placeholderTextColor="#6b7280"
            value={newPostContent}
            onChangeText={setNewPostContent}
            multiline
            maxLength={2000}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowNewPostForm(false);
                setNewPostTitle('');
                setNewPostContent('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleCreatePost}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {loading ? (
        <ActivityIndicator size="large" color="#b794f6" style={{ marginTop: 40 }} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={60} color="#6b7280" />
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>Be the first to start a discussion!</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchPosts(selectedCategory!.id);
              }}
              tintColor="#b794f6"
            />
          }
        >
          {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.postCard}
              onPress={() => handlePostSelect(post)}
            >
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postContent} numberOfLines={2}>
                {post.content}
              </Text>
              <View style={styles.postMeta}>
                <View style={styles.authorContainer}>
                  {post.is_admin && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#ffd700" />
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  <Text style={[styles.postAuthor, post.is_admin && styles.adminAuthor]}>{post.author_name}</Text>
                </View>
                <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
              </View>
              <View style={styles.postStats}>
                <TouchableOpacity
                  style={styles.statButton}
                  onPress={() => handleLikePost(post.id)}
                >
                  <Ionicons name="heart-outline" size={18} color="#9f7aea" />
                  <Text style={styles.statText}>{post.likes}</Text>
                </TouchableOpacity>
                <View style={styles.statButton}>
                  <Ionicons name="chatbubble-outline" size={18} color="#9f7aea" />
                  <Text style={styles.statText}>{post.comment_count}</Text>
                </View>
                {post.author_id !== user?._id && (
                  <TouchableOpacity
                    style={styles.flagButton}
                    onPress={() => handleFlagContent('post', post.id)}
                    disabled={flagging}
                  >
                    <Ionicons name="flag-outline" size={16} color="#f59e0b" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );

  // Render Post Detail
  const renderPostDetail = () => (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.postDetailScroll}>
        <View style={styles.postDetailHeader}>
          <Text style={styles.postDetailTitle}>{selectedPost?.title}</Text>
          <View style={styles.postMeta}>
            <View style={styles.authorContainer}>
              {selectedPost?.is_admin && (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#ffd700" />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
              <Text style={[styles.postAuthor, selectedPost?.is_admin && styles.adminAuthor]}>{selectedPost?.author_name}</Text>
            </View>
            <Text style={styles.postTime}>
              {selectedPost && formatTime(selectedPost.created_at)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.postDetailContent}>{selectedPost?.content}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.commentsTitle}>
          Comments ({comments.length})
        </Text>
        
        {comments.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              {comment.is_admin && (
                <View style={styles.adminBadgeSmall}>
                  <Ionicons name="shield-checkmark" size={10} color="#ffd700" />
                  <Text style={styles.adminBadgeTextSmall}>Admin</Text>
                </View>
              )}
              <Text style={[styles.commentAuthor, comment.is_admin && styles.adminAuthor]}>{comment.author_name}</Text>
              <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
              {comment.author_id !== user?._id && (
                <TouchableOpacity
                  style={styles.flagButtonSmall}
                  onPress={() => handleFlagContent('comment', comment.id)}
                  disabled={flagging}
                >
                  <Ionicons name="flag-outline" size={14} color="#f59e0b" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.commentContent}>{comment.content}</Text>
          </View>
        ))}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      <View style={styles.commentInputContainer}>
        {error && (
          <Text style={styles.inputError}>{error}</Text>
        )}
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#6b7280"
            value={newComment}
            onChangeText={setNewComment}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // Render Chat Room
  const renderChat = () => (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.chatHeader}>
        <View style={[styles.chatRoomIcon, { backgroundColor: selectedCategory?.color }]}>
          <Ionicons name="chatbubbles" size={16} color="#fff" />
        </View>
        <Text style={styles.chatHeaderTitle}>{selectedCategory?.name} Chat</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>
      
      <FlatList
        ref={chatScrollRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        style={styles.chatMessages}
        contentContainerStyle={styles.chatMessagesContent}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd()}
        renderItem={({ item }) => {
          const isOwnMessage = item.author_id === user?._id;
          return (
            <View style={[
              styles.chatBubble,
              isOwnMessage ? styles.chatBubbleOwn : styles.chatBubbleOther,
              item.is_admin && !isOwnMessage && styles.chatBubbleAdmin
            ]}>
              {!isOwnMessage && (
                <View style={styles.chatAuthorRow}>
                  {item.is_admin && (
                    <View style={styles.adminBadgeChat}>
                      <Ionicons name="shield-checkmark" size={10} color="#ffd700" />
                      <Text style={styles.adminBadgeChatText}>Admin</Text>
                    </View>
                  )}
                  <Text style={[styles.chatAuthor, item.is_admin && styles.adminAuthor]}>{item.author_name}</Text>
                  <TouchableOpacity
                    style={styles.flagButtonChat}
                    onPress={() => handleFlagContent('chat', item.id)}
                    disabled={flagging}
                  >
                    <Ionicons name="flag-outline" size={12} color="#f59e0b" />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.chatText}>{item.message}</Text>
              <Text style={styles.chatTime}>{formatTime(item.created_at)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={50} color="#6b7280" />
            <Text style={styles.emptyChatText}>No messages yet</Text>
            <Text style={styles.emptyChatSubtext}>Start the conversation!</Text>
          </View>
        }
      />
      
      <View style={styles.chatInputContainer}>
        {error && (
          <Text style={styles.inputError}>{error}</Text>
        )}
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={newMessage}
            onChangeText={setNewMessage}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Banner */}
      <HeaderBanner title="Community" height={100} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {viewMode === 'categories' && 'Community'}
          {viewMode === 'posts' && selectedCategory?.name}
          {viewMode === 'post-detail' && 'Discussion'}
          {viewMode === 'chat' && `${selectedCategory?.name} Chat`}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Content */}
      {viewMode === 'categories' && renderCategories()}
      {viewMode === 'posts' && renderPosts()}
      {viewMode === 'post-detail' && renderPostDetail()}
      {viewMode === 'chat' && renderChat()}
      
      {/* Flag Success Notification */}
      {flagSuccess && (
        <View style={styles.flagSuccessContainer}>
          <View style={styles.flagSuccessContent}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.flagSuccessText}>{flagSuccess}</Text>
          </View>
        </View>
      )}

      {/* Guidelines Agreement Modal */}
      <Modal visible={showGuidelines} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.guidelinesContainer}>
          <HeaderBanner title="Guidelines" height={100} />
          <ScrollView style={styles.guidelinesScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.guidelinesContent}>
              <View style={styles.guidelinesHeader}>
                <Ionicons name="people-circle" size={50} color="#9f7aea" />
                <Text style={styles.guidelinesTitle}>Community Guidelines</Text>
                <Text style={styles.guidelinesSubtitle}>
                  Please read and agree to our community guidelines before participating.
                </Text>
              </View>

              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesSectionTitle}>1. AI Moderation</Text>
                <Text style={styles.guidelinesText}>
                  Our community is monitored by an AI-powered moderation system that automatically reviews content for compliance with our guidelines.
                </Text>
              </View>

              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesSectionTitle}>2. Community Standards</Text>
                <Text style={styles.guidelinesText}>
                  • Treat others with respect and kindness{'\n'}
                  • No hate speech, discrimination, or harassment{'\n'}
                  • No spam, advertisements, or promotional content{'\n'}
                  • Keep discussions relevant and constructive{'\n'}
                  • Respect others' spiritual beliefs and practices
                </Text>
              </View>

              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesSectionTitle}>3. Suspension Policy</Text>
                <Text style={styles.guidelinesText}>
                  Violations result in progressive actions:{'\n'}
                  • First offense: Written warning{'\n'}
                  • Second offense (3+ flags): 2-week suspension{'\n'}
                  • Third offense: 30-day suspension{'\n'}
                  • Continued violations: Permanent account cancellation
                </Text>
              </View>

              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesSectionTitle}>4. Appeals Process</Text>
                <Text style={styles.guidelinesText}>
                  If you believe a moderation action was taken in error, an appeal link will be included in the notification email. Appeals are typically reviewed within 3-5 business days.
                </Text>
              </View>

              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesSectionTitle}>5. No Refunds Policy</Text>
                <View style={styles.guidelinesWarning}>
                  <Ionicons name="information-circle" size={20} color="#9f7aea" />
                  <Text style={styles.guidelinesWarningText}>
                    All subscription payments are final. No refunds will be issued for accounts suspended or cancelled due to violations of these guidelines.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.guidelinesViewFull}
                onPress={() => {
                  setShowGuidelines(false);
                  router.push('/community-guidelines');
                }}
              >
                <Text style={styles.guidelinesViewFullText}>View Full Guidelines</Text>
                <Ionicons name="open-outline" size={16} color="#9f7aea" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.guidelinesFooter}>
            <TouchableOpacity
              style={styles.guidelinesDeclineBtn}
              onPress={() => {
                setShowGuidelines(false);
                router.back();
              }}
            >
              <Text style={styles.guidelinesDeclineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guidelinesAgreeBtn}
              onPress={handleAgreeToGuidelines}
              disabled={agreeingToGuidelines}
            >
              {agreeingToGuidelines ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.guidelinesAgreeText}>I Agree</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a0033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  heroImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    backgroundImage: 'linear-gradient(transparent, rgba(10, 0, 20, 0.9))',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9f7aea',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  premiumBannerText: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 13,
    color: '#9f7aea',
  },
  chatRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatRoomIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatRoomName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  newPostButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPostForm: {
    backgroundColor: '#1a0033',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  contentInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#9f7aea',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  postCard: {
    backgroundColor: '#1a0033',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  postAuthor: {
    fontSize: 13,
    color: '#9f7aea',
    fontWeight: '500',
  },
  postTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#9f7aea',
  },
  postDetailScroll: {
    flex: 1,
    padding: 16,
  },
  postDetailHeader: {
    marginBottom: 16,
  },
  postDetailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  postDetailContent: {
    fontSize: 16,
    color: '#e9d5ff',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#2d1b4e',
    marginVertical: 20,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  commentCard: {
    backgroundColor: '#1a0033',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b794f6',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  commentContent: {
    fontSize: 14,
    color: '#e9d5ff',
    lineHeight: 20,
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    backgroundColor: '#0a0014',
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a0033',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4c1d95',
  },
  inputError: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 8,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 10,
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  chatBubbleOwn: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    backgroundColor: '#1a0033',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b794f6',
    marginBottom: 4,
  },
  chatText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  chatTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    textAlign: 'right',
  },
  emptyChat: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9f7aea',
    marginTop: 12,
  },
  emptyChatSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  chatInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    backgroundColor: '#0a0014',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1a0033',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  // Admin badge styles
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffd700',
    textTransform: 'uppercase',
  },
  adminBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
    marginRight: 6,
  },
  adminBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffd700',
    textTransform: 'uppercase',
  },
  adminAuthor: {
    color: '#ffd700',
    fontWeight: '600',
  },
  // Chat admin styles
  chatAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  adminBadgeChat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  adminBadgeChatText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffd700',
    textTransform: 'uppercase',
  },
  chatBubbleAdmin: {
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    backgroundColor: '#251040',
  },
  // Flag button styles
  flagButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  flagButtonSmall: {
    padding: 4,
    marginLeft: 'auto',
    borderRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  flagButtonChat: {
    padding: 4,
    marginLeft: 'auto',
    borderRadius: 4,
  },
  flagSuccessContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  flagSuccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3328',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  flagSuccessText: {
    flex: 1,
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  // Guidelines Modal styles
  guidelinesContainer: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  guidelinesScroll: {
    flex: 1,
  },
  guidelinesContent: {
    padding: 20,
  },
  guidelinesHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  guidelinesSubtitle: {
    fontSize: 14,
    color: '#9f7aea',
    textAlign: 'center',
    lineHeight: 20,
  },
  guidelinesSection: {
    marginBottom: 20,
  },
  guidelinesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  guidelinesText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 22,
  },
  guidelinesWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(159, 122, 234, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(159, 122, 234, 0.3)',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  guidelinesWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#e9d5ff',
    lineHeight: 20,
  },
  guidelinesViewFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  guidelinesViewFullText: {
    fontSize: 14,
    color: '#9f7aea',
    fontWeight: '500',
  },
  guidelinesFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    backgroundColor: '#0a0014',
  },
  guidelinesDeclineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelinesDeclineText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
  guidelinesAgreeBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guidelinesAgreeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
