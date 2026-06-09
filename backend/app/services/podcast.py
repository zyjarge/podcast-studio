# backend/app/services/podcast.py
"""
Podcast generation service - wraps LLM and TTS services
"""
import os
import logging
from typing import Optional

from app.core.config import settings
from app.services.llm import DeepSeekService
from app.services.tts import MiniMaxTTSService

logger = logging.getLogger(__name__)


class PodcastService:
    def __init__(self):
        self.llm = None
        self.tts = None
        
        # Initialize services if API keys are available
        if settings.DEEPSEEK_API_KEY:
            self.llm = DeepSeekService(
                api_key=settings.DEEPSEEK_API_KEY,
                model=settings.DEEPSEEK_MODEL
            )
            logger.info("DeepSeek LLM service initialized")
        else:
            logger.warning("DEEPSEEK_API_KEY not set, LLM service not available")
            
        if settings.MINIMAX_API_KEY:
            self.tts = MiniMaxTTSService()
            logger.info("MiniMax TTS service initialized")
        else:
            logger.warning("MINIMAX_API_KEY not set, TTS service not available")

    async def generate_script(
        self,
        news_content: str,
        role_prompt: str = "",
        max_tokens: int = 4096
    ) -> str:
        """
        Generate podcast script from news content using DeepSeek
        
        Args:
            news_content: The news article content
            role_prompt: Prompt defining the speaker roles
            max_tokens: Maximum tokens for generation
            
        Returns:
            Generated script text
        """
        if not self.llm:
            raise RuntimeError("LLM service not initialized. Please set DEEPSEEK_API_KEY")
        
        from app.services.llm import PODCAST_USER_TEMPLATE
        
        prompt = PODCAST_USER_TEMPLATE.format(news_text=news_content)
        
        response = self.llm.generate(
            prompt=prompt,
            system_prompt=role_prompt,
            max_tokens=max_tokens,
            temperature=0.8
        )
        
        logger.info(f"Generated script: {len(response.text)} chars")
        return response.text

    async def generate_episode_script(
        self,
        news_items: list,
        episode_notes: str = "",
        max_tokens: int = 8192
    ) -> str:
        """
        Generate a full episode podcast script from all news items.

        Args:
            news_items: list of dicts with keys: title, summary, content, notes
                        e.g. [{"title": "...", "summary": "...", "content": "...", "notes": "..."}]
            episode_notes: Episode-level notes (e.g. "今天是高考日，增加对考生的祝福")
            max_tokens: Max tokens for generation

        Returns:
            Full episode script text
        """
        if not self.llm:
            raise RuntimeError("LLM service not initialized. Please set DEEPSEEK_API_KEY")

        from app.services.llm import PODCAST_SYSTEM_PROMPT, PODCAST_USER_TEMPLATE, get_intro

        # Build news content with per-news notes
        news_blocks = []
        for i, item in enumerate(news_items, 1):
            title = item.get("title", "")
            summary = item.get("summary", "")
            content = item.get("content", "")
            notes = item.get("notes", "")

            # Use content if available, fallback to summary
            body = content or summary or title

            block = f"新闻{i}：{title}\n摘要: {body}"
            if notes:
                block += f"\n【编辑备注】: {notes}"
            news_blocks.append(block)

        news_text = "\n\n".join(news_blocks)

        # Build prompt with episode notes
        extra_instructions = ""
        if episode_notes:
            extra_instructions = f"\n\n【节目备注/额外要求】:\n{episode_notes}"

        prompt = PODCAST_USER_TEMPLATE.format(news_text=news_text) + extra_instructions

        logger.info(
            f"Generating episode script: {len(news_items)} news items, "
            f"episode_notes={'yes' if episode_notes else 'no'}, max_tokens={max_tokens}"
        )

        response = self.llm.generate(
            prompt=prompt,
            system_prompt=PODCAST_SYSTEM_PROMPT,
            max_tokens=max_tokens,
            temperature=0.8
        )

        # Prepend intro
        intro = get_intro()
        full_script = f"{intro}\n\n{response.text}"

        logger.info(f"Generated episode script: {len(full_script)} chars")
        return full_script

    async def generate_audio(
        self,
        script: str,
        voice_id: str = "luoyonghao",
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate audio from script using MiniMax TTS
        
        Args:
            script: The script text to convert to speech
            voice_id: The voice ID to use (luoyonghao or wangziru)
            output_path: Path to save the audio file
            
        Returns:
            Path to the generated audio file
        """
        if not self.tts:
            raise RuntimeError("TTS service not initialized. Please set MINIMAX_API_KEY")
        
        if not output_path:
            output_path = f"/tmp/podcast_{voice_id}.mp3"
        
        # Parse dialogues from script and generate audio
        dialogues = self.tts.parse_script(script)
        
        if not dialogues:
            logger.warning("No dialogues found in script")
            return ""
        
        # Generate audio for all dialogues
        audio_files = self.tts.generate(dialogues)
        
        # Merge audio files
        output_file = self.tts.merge_audio(audio_files, output_path)
        
        logger.info(f"Generated audio: {output_file}")
        return output_file


# Singleton instance
podcast_service = PodcastService()


def get_podcast_service() -> PodcastService:
    """Get the podcast service singleton"""
    return podcast_service
