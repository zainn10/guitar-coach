#!/usr/bin/perl
# Tiny private web server for Guitar Coach. Only reachable from this Mac (127.0.0.1).
# Chrome remembers microphone permission for http://localhost, but not for files opened from disk.
# It also lets the page read lessons aloud with the Mac's own System Voice (e.g. a Siri voice),
# which Chrome can't use directly.
# Usage: perl server.pl PORT /path/to/app.html guitarcoach-server
use strict;
use warnings;
use IO::Socket::INET;

my ($port, $file) = @ARGV;
my $SAY = '/usr/bin/say';
my $PIDFILE = "/tmp/guitarcoach-say-$<.pid";
my %OK_ORIGIN = map { $_ => 1 } ("http://localhost:$port", "http://127.0.0.1:$port");

my $srv = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 20, ReuseAddr => 1, Timeout => 600)
  or die "Could not start on port $port\n";
$SIG{CHLD} = 'IGNORE';
my $idle = 0;

sub reply {
  my ($c, $status, $type, $body) = @_;
  print $c "HTTP/1.1 $status\r\nContent-Type: $type\r\nCache-Control: no-store\r\nContent-Length: " . length($body) . "\r\nConnection: close\r\n\r\n$body";
}

# Stop whatever the Mac is currently saying for Guitar Coach (only our own `say` process).
sub stop_speaking {
  open(my $fh, '<', $PIDFILE) or return;
  my $pid = <$fh>; close $fh;
  unlink $PIDFILE;
  return unless defined $pid && $pid =~ /^(\d+)$/;
  $pid = $1;
  my $comm = `/bin/ps -p $pid -o comm= 2>/dev/null` // '';
  kill 'TERM', $pid if $comm =~ m{(^|/)say\s*$};
}

while (1) {
  my $c = $srv->accept;
  if (!$c) { $idle += 600; exit 0 if $idle >= 6 * 3600; next; }   # stop after 6 idle hours
  $idle = 0;
  my $pid = fork();
  if (!defined $pid) { close $c; next; }
  if ($pid) { close $c; next; }
  # child: handle one request
  $SIG{CHLD} = 'DEFAULT';   # so we can wait for `say` to finish
  alarm 15;
  my $req = <$c> // '';
  my %h;
  while (my $l = <$c>) {
    last if $l =~ /^\r?\n$/;
    $h{lc $1} = $2 if $l =~ /^([\w-]+):\s*(.*?)\r?$/;
  }
  my ($method, $path) = $req =~ m{^(GET|POST)\s+(\S+)};
  $method //= ''; $path //= '';
  # Speech requests must come from Guitar Coach's own page: a custom header (which other
  # websites can't send here without permission we never give) and, if sent, our own origin.
  my $ours = ($h{'x-guitar-coach'} // '') eq '1' && (!defined $h{origin} || $OK_ORIGIN{$h{origin}});

  if ($method eq 'GET' && $path eq '/ping') {
    reply($c, '200 OK', 'text/plain', 'guitar-coach');
  } elsif ($method eq 'GET' && $path eq '/caps') {
    reply($c, '200 OK', 'text/plain', -x $SAY ? 'say' : '');
  } elsif ($method eq 'POST' && $path =~ m{^/say(?:\?rate=(\d{2,3}))?$} && $ours) {
    my $rate = $1 // 180;
    $rate = 90 if $rate < 90; $rate = 360 if $rate > 360;
    my $len = $h{'content-length'} // 0;
    if ($len !~ /^\d+$/ || $len > 8000) { reply($c, '413 Too Large', 'text/plain', ''); close $c; exit 0; }
    my $text = '';
    read($c, $text, $len) if $len;
    $text =~ s/[\x00-\x08\x0B-\x1F\x7F]/ /g;   # no control characters
    $text = substr($text, 0, 2000);
    stop_speaking();
    alarm 180;
    # Run `say` directly (no shell) and give it the text on its input, never as a command argument.
    my $kid = open(my $p, '|-', $SAY, '-r', $rate);
    if ($kid) {
      if (open(my $pf, '>', $PIDFILE)) { print $pf $kid; close $pf; }
      binmode $p; print $p $text; close $p;   # waits until it has finished speaking (or was stopped)
      reply($c, '200 OK', 'text/plain', 'done');
    } else {
      reply($c, '500 Error', 'text/plain', '');
    }
  } elsif ($method eq 'POST' && $path eq '/say/stop' && $ours) {
    stop_speaking();
    reply($c, '200 OK', 'text/plain', 'stopped');
  } elsif ($method eq 'GET' && $path =~ m{^/(index\.html)?(\?.*)?$}) {
    if (open(my $fh, '<:raw', $file)) {
      local $/; my $body = <$fh>; close $fh;
      reply($c, '200 OK', 'text/html; charset=utf-8', $body);
    } else {
      reply($c, '500 Error', 'text/plain', '');
    }
  } else {
    reply($c, '404 Not Found', 'text/plain', '');
  }
  close $c;
  exit 0;
}
