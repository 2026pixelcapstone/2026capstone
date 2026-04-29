import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LikeState {
  // galleryLikes: postId -> isLiked
  galleryLikes: Record<number, boolean>
  setGalleryLike: (postId: number, isLiked: boolean) => void
  removeGalleryLike: (postId: number) => void
  getGalleryLike: (postId: number) => boolean | undefined
}

export const useLikeStore = create<LikeState>()(
  persist(
    (set, get) => ({
      galleryLikes: {},

      setGalleryLike: (postId, isLiked) =>
        set(state => ({
          galleryLikes: { ...state.galleryLikes, [postId]: isLiked },
        })),

      removeGalleryLike: (postId) =>
        set(state => {
          const next = { ...state.galleryLikes }
          delete next[postId]
          return { galleryLikes: next }
        }),

      getGalleryLike: (postId) => get().galleryLikes[postId],
    }),
    {
      name: 'like-storage',
    }
  )
)
