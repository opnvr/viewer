ffmpeg -i rtsp://admin:Milly%20Lola%20810@192.168.1.206:554/Streaming/Channels/102 \
  -c:v copy -an \
  -movflags omit_tfhd_offset+frag_keyframe+default_base_moof \
  -f mp4 tcp://localhost:8081/


# ffmpeg -i rtsp://admin:Milly%20Lola%20810@192.168.1.206:554/Streaming/Channels/102 \
#   -c:v copy -an \
#   -movflags omit_tfhd_offset+frag_keyframe+default_base_moof \
#   -f mp4 tcp://localhost:8081/
