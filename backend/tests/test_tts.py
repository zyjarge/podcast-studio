"""Tests for TTS Service"""
import pytest
import os
from app.services.tts import MiniMaxTTSService, Dialogue, VOICE_IDS


class TestMiniMaxTTSService:
    """Test MiniMax TTS service"""

    def test_voice_ids_loaded(self):
        """Test that voice IDs are loaded"""
        assert "luoyonghao" in VOICE_IDS
        assert "wangziru" in VOICE_IDS
        assert VOICE_IDS["luoyonghao"] == "luoyonghao2"
        assert VOICE_IDS["wangziru"] == "wangziru_test"

    def test_parse_dialogues(self):
        """Test parsing dialogues from script"""
        tts = MiniMaxTTSService()
        
        script = '''**彪悍罗：**各位听众朋友大家好，欢迎收听《科技双响炮》。

**OK王：**老罗，咱们今天聊苹果。'''
        
        dialogues = tts.parse_script(script)
        
        assert len(dialogues) == 2
        assert dialogues[0].speaker == "luoyonghao"
        assert dialogues[1].speaker == "wangziru"
        assert "各位听众" in dialogues[0].text
        assert "老罗" in dialogues[1].text

    def test_parse_empty_script(self):
        """Test parsing empty script"""
        tts = MiniMaxTTSService()
        
        dialogues = tts.parse_script("")
        assert len(dialogues) == 0

    @pytest.mark.slow
    def test_batch_generate(self):
        """Test batch audio generation (requires API key)"""
        from app.core.config import settings
        
        if not settings.MINIMAX_API_KEY:
            pytest.skip("MINIMAX_API_KEY not set")
        
        tts = MiniMaxTTSService()
        
        dialogues = [
            Dialogue(speaker='luoyonghao', text='测试语音生成', index=0),
        ]
        
        output_dir = '/tmp/podcast_test_unit'
        os.makedirs(output_dir, exist_ok=True)
        
        # Clean up existing files
        for f in os.listdir(output_dir):
            os.remove(os.path.join(output_dir, f))
        
        audio_files = tts.batch_generate(dialogues, output_dir)
        
        assert len(audio_files) == 1
        assert os.path.exists(audio_files[0])
        assert os.path.getsize(audio_files[0]) > 0
        
        print(f"\nGenerated audio: {audio_files[0]} ({os.path.getsize(audio_files[0])} bytes)")
